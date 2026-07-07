from pathlib import Path

from langchain_community.document_loaders import PyMuPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

class PDFProcessor:
    def __init__(self, file_name, chunk_size, chunk_overlap, separators=None):
        self._file_path = str(Path(__file__).parent / 'example_data' / file_name)
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = separators or ['\n\n', '\n', ' ', '']
        self._splitter = RecursiveCharacterTextSplitter(
            chunk_size = self.chunk_size,
            chunk_overlap = self.chunk_overlap,
            length_function = len,
            separators = self.separators,
        )
        self.pages = []
        self.processed_chunks = []
        
    def load_pdf_file(self):
        '''Load PDF into pages with PyMuPDFLoader'''
        loader = PyMuPDFLoader(self._file_path, mode = 'page')
        self.pages = loader.load()

    def clean_text(self, text):
        '''Normalize whitespace in text'''
        return ' '.join(text.split())

    def split_text(self, text):
        '''Split text into chunks'''
        return self._splitter.split_text(text)

    def process(self):
        
        self.load_pdf_file()
        self.processed_chunks = []
        
        for doc in self.pages:
            cleaned_text = self.clean_text(doc.page_content)
            chunks = self.split_text(cleaned_text)
            
            for chunk in chunks:
                self.processed_chunks.append({
                    'text': chunk,
                    'metadata': {
                        'page': doc.metadata.get('page', 0),
                        'source': doc.metadata.get('source', ''),
                        'title': doc.metadata.get('title', ''),
                        'author': doc.metadata.get('author', ''),
                    }
                })
                
        return self.processed_chunks