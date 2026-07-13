import ollama
from langchain_core.documents import Document
from langchain_community.vectorstores import Chroma
import logging

class EmbeddingHandler:
    
    def __init__(self, embedded_model, collection: Chroma):
        # self.endpoint = 'http://localhost:11434/api/embeddings'
        self.embedded_model = embedded_model
        self.collection = collection
        self.text = []
        self.logger = logging.getLogger(__name__)
        
    def embed_documents(self, chunks):
        self.text = [chunk['text'] for chunk in chunks]
        total_chunks = len(self.text)
        processed_count = 0
        
        self.logger.info(f'Starting to process {total_chunks} chunks. . .')
        
        for i, d in enumerate(self.text):
            
            existing_docs = self.collection.similarity_search(d, k=1)
            if existing_docs and existing_docs[0].page_content == d:
                self.logger.info(f'Skipping chunk {i+1}/{total_chunks} - already exists')
                processed_count += 1
                continue
            
            self.logger.info(f'Processing new chunk {i+1}/{total_chunks}')
            
            model_name = self.embedded_model.model if hasattr(self.embedded_model, 'model') else str(self.embedded_model)
            response = ollama.embed(model_name, input = d)
            embeddings = response['embeddings']
            doc = Document(
                page_content = d,
                metadata = chunks[i]['metadata']
            )
            self.collection.add_documents(
                documents=[doc],
                embeddings=[embeddings]
            )
            processed_count += 1