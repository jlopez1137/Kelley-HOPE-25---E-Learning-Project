'''Standalone ingestion script: embeds a PDF into ChromaDB.

Run from the project root:
    python RAG/ingest.py
'''
import logging
import sys
from pathlib import Path

# Ensure the RAG/ directory is importable regardless of how the script is launched
sys.path.insert(0, str(Path(__file__).resolve().parent))

PDF_NAME = 'pe2_staff.pdf'

def main():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    logger = logging.getLogger('ingest')

    # rag.py loads RAG/config.yaml relative to the current working directory,
    # so this script must be run from the project root
    config_path = Path.cwd() / 'RAG' / 'config.yaml'
    if not config_path.exists():
        logger.error(f'Cannot find {config_path}. Run this script from the project root '
                     f'(/home/hope-intern04/digital-human).')
        sys.exit(1)

    logger.info(f'Loading RAG module (config: {config_path}). . .')
    from rag import embed_pdf, CONFIG

    logger.info(f"Embedding model: {CONFIG['embedding_model']['name']}")
    logger.info(f"Chroma collection: {CONFIG['chroma_db']['collection_name']} "
                f"(persist: {CONFIG['chroma_db']['persist_directory']})")

    logger.info(f'Starting ingestion of {PDF_NAME}. . .')
    embed_pdf(PDF_NAME)

    # Report final document count as a sanity check
    from langchain_ollama import OllamaEmbeddings
    from langchain_chroma import Chroma
    vectorstore = Chroma(
        embedding_function=OllamaEmbeddings(model=CONFIG['embedding_model']['name']),
        persist_directory=CONFIG['chroma_db']['persist_directory'],
        collection_name=CONFIG['chroma_db']['collection_name'],
    )
    logger.info(f'Ingestion complete. Documents now in collection: {vectorstore._collection.count()}')

if __name__ == '__main__':
    main()
