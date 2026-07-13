import posthog

posthog.disabled = True

from pdfprocess import PDFProcessor
from embedding import EmbeddingHandler
from langchain_ollama import OllamaEmbeddings, ChatOllama
from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
import os
import time
import logging

import yaml
# Loading config from config YAML
with open('RAG/config.yaml', 'r') as f:
    CONFIG = yaml.safe_load(f)
    
from dotenv import load_dotenv
from pathlib import Path
# Loading environment variables
dotenv_path = Path(__file__).resolve().parents[1] / '.env'
load_dotenv(dotenv_path)
    
def serve_rag():
    """Initialize the RAG system with Ollama and ChromaDB."""
    
    logger = logging.getLogger(__name__)
    
    embedding_model = OllamaEmbeddings(model = CONFIG['embedding_model']['name'])
    
    logger.info('Connecting to ChromaDB. . .')
    vectorstore = Chroma(
        embedding_function = embedding_model,
        persist_directory = CONFIG['chroma_db']['persist_directory'],
        collection_name = CONFIG['chroma_db']['collection_name'],
    )
    
    doc_count = vectorstore._collection.count()
    logger.warning(f'Number of documents in database: {doc_count}')
    if doc_count == 0:
        logger.error('No documents found in the vector store. Please ensure embeddings are processed and stored.')
        return

    # ToDo: Add switch for different LLMs
    llm = ChatOllama(
        model = CONFIG['llm']['ollama_model'],
        keep_alive = CONFIG['llm'].get('keep_alive', '30m'),
        num_predict = CONFIG['llm'].get('num_predict', 512),
        num_ctx = CONFIG['llm'].get('num_ctx', 4096),
        temperature = CONFIG['llm'].get('temperature', 0.2),
    )

    # Utilizing Gemini API
    # llm = ChatGoogleGenerativeAI(
    #     model = os.getenv('GEMINI_MODEL'),
    #     google_api_key = os.getenv('GOOGLE_API_KEY'),
    #     temperature = 0
    # )

    logger.info('Creating RAG chain. . .')
    retriever = vectorstore.as_retriever(search_kwargs={'k': CONFIG['retrieval_qa']['retrieve_k']})

    prompt = ChatPromptTemplate.from_template(
        'Answer the question based only on the following context. '
        'If the context does not contain the answer, say so.\n\n'
        'Context:\n{context}\n\n'
        'Question: {question}'
    )

    answer_chain = prompt | llm | StrOutputParser()

    def format_docs(docs):
        return '\n\n'.join(doc.page_content for doc in docs)

    def answer_query(query: str):
        t0 = time.perf_counter()
        source_documents = retriever.invoke(query)
        t1 = time.perf_counter()
        result = answer_chain.invoke({
            'context': format_docs(source_documents),
            'question': query,
        })
        t2 = time.perf_counter()
        logger.info(f'RAG timing: retrieval {t1 - t0:.2f}s, generation {t2 - t1:.2f}s, total {t2 - t0:.2f}s')
        return {'result': result, 'source_documents': source_documents}

    def stream_query(query: str):
        t0 = time.perf_counter()
        source_documents = retriever.invoke(query)
        t1 = time.perf_counter()
        first_token_at = None
        for delta in answer_chain.stream({
            'context': format_docs(source_documents),
            'question': query,
        }):
            if first_token_at is None:
                first_token_at = time.perf_counter()
            yield delta
        t2 = time.perf_counter()
        ttft = (first_token_at or t2) - t1
        logger.info(f'RAG timing (stream): retrieval {t1 - t0:.2f}s, first token {ttft:.2f}s, generation {t2 - t1:.2f}s, total {t2 - t0:.2f}s')

    return _RAGRunner(answer_query, stream_query)


class _RAGRunner:
    """Keeps the .invoke(query) interface used by run_rag(), plus .stream(query) for SSE."""

    def __init__(self, answer_query, stream_query):
        self._answer_query = answer_query
        self._stream_query = stream_query

    def invoke(self, query: str):
        return self._answer_query(query)

    def stream(self, query: str):
        return self._stream_query(query)

def embed_pdf(title):
    
    logger = logging.getLogger(__name__)
    
    logger.info('Initializing PDF Processor. . .')
    pdf_processor = PDFProcessor(
        file_name = title,
        chunk_size = CONFIG['pdf_processor']['chunk_size'],
        chunk_overlap = CONFIG['pdf_processor']['chunk_overlap'],
    )
    
    chunks = pdf_processor.process()
    
    embedding_model = OllamaEmbeddings(model = CONFIG['embedding_model']['name'])
    
    logger.info('Initializing ChromaDB Vector Store. . .')
    
    try:
        vectorstore = Chroma(
            embedding_function = embedding_model,
            persist_directory = CONFIG['chroma_db']['persist_directory'],
            collection_name = CONFIG['chroma_db']['collection_name'],
        )
    except Exception as e:
        logger.error(f'Error initializing ChromaDB: {e}')
        return
    
    embedding_handler = EmbeddingHandler(
        embedded_model = embedding_model,
        collection = vectorstore,
    )
    
    logger.info('Processing and storing embeddings. . .')
    if not chunks:
        logger.warning('No chunks to process. Exiting.')
        return
    
    embedding_handler.embed_documents(chunks)
    
    
# Load TTS model on import
# DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
try:
    from TTS.api import TTS
    coqui_tts = TTS(CONFIG['tts']['model'], progress_bar=False)
except Exception as e:
    coqui_tts = None
    logging.getLogger(__name__).warning(f'Coqui TTS unavailable, TTS features disabled: {e}')

def tts(text: str):
    if coqui_tts is None:
        logging.getLogger(__name__).warning('Coqui TTS is not installed; skipping TTS playback.')
        return None

    import soundfile as sf
    import sounddevice as sd

    # Removes <think> </think> from LLM output
    # Only necessary for Thinking Models like Qwen3 and Deepseek-r1
    if '<think>' in text:
        text = text.split('</think>')[1]

    # Generate audio
    wav = coqui_tts.tts(text)

    sd.play(wav, samplerate = 22050)
    sd.wait()

async def tts_async(text: str):
    import asyncio
    ''' Run TTS in background'''
    if coqui_tts is None:
        logging.getLogger(__name__).warning('Coqui TTS is not installed; skipping TTS playback.')
        return None
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, tts, text)
    
# The chain (embeddings client, Chroma handle, LLM client) is expensive to build,
# so it is created once and shared by all requests.
_qa_chain = None

def get_qa_chain():
    global _qa_chain
    if _qa_chain is None:
        _qa_chain = serve_rag()
    return _qa_chain

def run_rag(query: str):
    return get_qa_chain().invoke(query)

def run_rag_stream(query: str):
    """Yield answer text deltas for the query (used by the SSE streaming path)."""
    return get_qa_chain().stream(query)

if __name__ == '__main__':
    
    import warnings
    warnings.filterwarnings('ignore', category=DeprecationWarning)
    logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # embed_pdf('redbook.pdf') # Uncomment to process the PDF and store embeddings
    qa_chain = serve_rag() # Initialize the RAG system
    
    response = qa_chain.invoke("Can you summarize chapter 5: routing protocols in detail?")
    rag_response = response['result']
    print(rag_response)