from quart import Quart, request, jsonify, Response
from quart_cors import cors
from rag import run_rag, run_rag_stream, get_qa_chain, tts, tts_async, CONFIG
import time, uuid, os, json, asyncio, logging
from dotenv import load_dotenv

load_dotenv()

app = Quart(__name__)
# Enable CORS for all routes
app = cors(app, allow_origin="*")

@app.before_serving
async def warmup():
    """Build the RAG chain and load the LLM into GPU memory before the first user request.

    Runs in the background so the server starts accepting requests (e.g. health probes)
    immediately; only the first chat request can still race the model load."""
    def _warm():
        try:
            get_qa_chain()
            import ollama
            # Empty prompt loads the model into memory without generating anything
            ollama.generate(
                model = CONFIG['llm']['ollama_model'],
                prompt = '',
                keep_alive = CONFIG['llm'].get('keep_alive', '30m'),
            )
            logging.getLogger(__name__).info('Warmup complete: RAG chain built, model loaded.')
        except Exception as e:
            logging.getLogger(__name__).error(f'Warmup failed: {e}')
    asyncio.get_running_loop().run_in_executor(None, _warm)

# Mimic OpenAI chat completion endpoint
@app.route('/v1/chat/completions', methods=['POST'])
async def chat_completions():
    try:
        # Receive JSON package
        data = await request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        model = data.get('model', os.getenv('RAG_MODEL'))
        messages = data.get('messages', [])
        if not messages:
            return jsonify({'error': 'No messages provided'}), 400
        
        # Extract the user query from the messages
        user_query = next((msg['content'] for msg in reversed(messages) if msg['role'] == 'user'), None)
        if not user_query:
            return jsonify({'error': 'No user query found'}), 400
        
        prompt_input = f'user: {user_query}'

        # Opt-in SSE streaming (OpenAI chunk format); the non-streaming path below is unchanged
        if data.get('stream'):
            return await stream_completion(prompt_input, model)

        # Inference takes tens of seconds — run it off the event loop so health
        # probes and other requests aren't blocked behind it
        rag_response = await asyncio.to_thread(run_rag, prompt_input)
        rag_result = rag_response['result']
        
        # Constructing the response in the OpenAI API format
        response = {
            'id': f'chatcmpl-{uuid.uuid4().hex[:10]}',
            'object': 'chat.completion',
            'created': int(time.time()),
            'model': model,
            'choices': [
            {
                'index': 0,
                'message':{
                    'role': 'assistant',
                    'content': rag_response['result']
                }
                ,
                'finish_reason': 'stop'
            }],
            # ToDo: Collect usage stats if needed
            'usage': {
                'prompt_tokens': 0,
                'completion_tokens': 0,
                'total_tokens': 0
            }
        }    
        
        # asyncio.create_task(tts_async(rag_result))
        return jsonify(response), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


async def stream_completion(prompt_input: str, model: str):
    """Return an SSE response streaming OpenAI-style chat.completion.chunk objects."""
    completion_id = f'chatcmpl-{uuid.uuid4().hex[:10]}'
    created = int(time.time())

    def make_chunk(delta: dict, finish_reason=None):
        return 'data: ' + json.dumps({
            'id': completion_id,
            'object': 'chat.completion.chunk',
            'created': created,
            'model': model,
            'choices': [{'index': 0, 'delta': delta, 'finish_reason': finish_reason}],
        }) + '\n\n'

    async def event_stream():
        queue = asyncio.Queue()
        loop = asyncio.get_running_loop()

        # run_rag_stream is a blocking generator (retrieval + Ollama streaming),
        # so drain it in a worker thread and hand chunks to the event loop
        def produce():
            try:
                for delta in run_rag_stream(prompt_input):
                    loop.call_soon_threadsafe(queue.put_nowait, ('delta', delta))
                loop.call_soon_threadsafe(queue.put_nowait, ('done', None))
            except Exception as e:
                loop.call_soon_threadsafe(queue.put_nowait, ('error', str(e)))

        loop.run_in_executor(None, produce)

        yield make_chunk({'role': 'assistant', 'content': ''})
        while True:
            kind, payload = await queue.get()
            if kind == 'delta':
                if payload:
                    yield make_chunk({'content': payload})
            elif kind == 'error':
                yield 'data: ' + json.dumps({'error': payload}) + '\n\n'
                break
            else:
                yield make_chunk({}, finish_reason='stop')
                break
        yield 'data: [DONE]\n\n'

    return Response(
        event_stream(),
        content_type = 'text/event-stream',
        headers = {'Cache-Control': 'no-cache', 'Connection': 'keep-alive'},
    )


if __name__ == '__main__':
    # INFO level so per-request RAG timing logs (retrieval vs generation) are visible
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    )
    # Run with Hypercorn or alternative ASGI server in prod
    app.run(debug=True, port=5000)