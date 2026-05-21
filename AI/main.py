import os
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI, Header, HTTPException
from sentence_transformers import SentenceTransformer
from google import genai
from pydantic import BaseModel
import torch

app = FastAPI(title="Unilibra AI API", description="Sistem rekomendasi dan pencarian semantik")
load_dotenv()
# --- 1. INISIALISASI MODEL & KONFIGURASI ---
device = 'cuda' if torch.cuda.is_available() else 'cpu'
# Cukup 1 model untuk seluruh aplikasi (Lebih hemat RAM/VRAM)
ai_model = SentenceTransformer('all-MiniLM-L6-v2', device=device)

DB_URL = os.getenv("DATABASE_URL")
GEMINI_API_KEY = os.getenv("GEMINI_API")
AI_INTERNAL_TOKEN = os.getenv("AI_INTERNAL_TOKEN")

client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

class ChatRequest(BaseModel):
    pesan: str

class BookEmbeddingRequest(BaseModel):
    book_id: int

# --- 2. FUNGSI UTILITAS ---
def get_db_connection():
    try:
        return psycopg2.connect(DB_URL, cursor_factory=RealDictCursor)
    except Exception as e:
        print(f"Database connection error: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")

# Pengganti cari_buku_relevan: Digunakan oleh /search dan /api/chat
def execute_semantic_search(query_text, limit=5):
    query_vector = ai_model.encode(query_text).tolist()
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id, title, author, description, category, rental_price,
                   status, cover_url, owner_id
            FROM books
            WHERE status = 'available'
              AND embedding IS NOT NULL
            ORDER BY embedding <=> %s::vector
            LIMIT %s
        """, (query_vector, limit))
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

def embedding_text(book):
    return " ".join(
        value for value in [
            book.get("title", ""),
            book.get("author", ""),
            book.get("category", ""),
            book.get("description", ""),
        ] if value
    )

def require_internal_token(token):
    if AI_INTERNAL_TOKEN and token != AI_INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="AI internal token tidak valid")

# --- 3. ENDPOINT API ---

@app.get("/")
def root():
    return {"message": "Unilibra AI Engine is Running!"}

@app.get("/health")
def health():
    return {
        "status": "ok",
        "device": device,
        "embedding_model": "all-MiniLM-L6-v2",
    }

@app.get("/search")
def search_books(query: str, limit: int = 5):
    # Menggunakan fungsi utilitas agar kode lebih ringkas
    results = execute_semantic_search(query, limit)
    return {"query": query, "results": results}

@app.get("/recommend/similar/{book_id}")
def recommend_similar_books(book_id: int, limit: int = 5):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT embedding FROM books WHERE id = %s", (book_id,))
        target = cur.fetchone()

        if not target or target["embedding"] is None:
            raise HTTPException(status_code=404, detail="Embedding buku belum tersedia")
            
        cur.execute("""
            SELECT id, title, author, description, category, rental_price,
                   status, cover_url, owner_id
            FROM books
            WHERE id != %s
              AND status = 'available'
              AND embedding IS NOT NULL
            ORDER BY embedding <=> %s::vector
            LIMIT %s
        """, (book_id, target['embedding'], limit))
        recommendations = cur.fetchall()
        return {"recommendations": recommendations}
    finally:
        cur.close()
        conn.close()

@app.get("/recommend/popular")
def get_popular_books(limit: int = 5):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT b.id, b.title, b.author, b.description, b.category,
                   b.rental_price, b.status, b.cover_url, b.owner_id,
                   COUNT(t.id) AS transaction_count
            FROM books b
            LEFT JOIN transactions t ON t.book_id = b.id
            WHERE b.status = 'available'
            GROUP BY b.id
            ORDER BY COUNT(t.id) DESC, b.updated_at DESC
            LIMIT %s
        """, (limit,))
        popular = cur.fetchall()
        return {"popular_books": popular}
    finally:
        cur.close()
        conn.close()

@app.post("/embeddings/books")
def refresh_book_embedding(
    req: BookEmbeddingRequest,
    x_ai_internal_token: str | None = Header(default=None),
):
    require_internal_token(x_ai_internal_token)
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id, title, author, description, category
            FROM books
            WHERE id = %s
        """, (req.book_id,))
        book = cur.fetchone()
        if not book:
            raise HTTPException(status_code=404, detail="Buku tidak ditemukan")

        vector = ai_model.encode(embedding_text(book)).tolist()
        cur.execute(
            "UPDATE books SET embedding = %s::vector, updated_at = NOW() WHERE id = %s",
            (vector, req.book_id),
        )
        conn.commit()
        return {"book_id": req.book_id, "status": "embedded"}
    finally:
        cur.close()
        conn.close()

@app.post("/api/chat")
def chatbot_unilibra(req: ChatRequest):
    try:
        if client is None:
            raise HTTPException(status_code=503, detail="GEMINI_API belum dikonfigurasi")

        # Langkah 1: Retrieval (Menggunakan fungsi utilitas yang sama dengan /search)
        buku_relevan = execute_semantic_search(req.pesan, limit=1500)
        
        konteks_buku = ""
        if buku_relevan:
            for idx, b in enumerate(buku_relevan, 1):
                konteks_buku += f"{idx}. '{b['title']}' oleh {b['author']} ({b.get('category') or 'Kategori belum diisi'})\n"
        else:
            konteks_buku = "Tidak ada buku spesifik yang relevan di database."

        # Langkah 2: Augmented Prompt
        prompt = f"""
        Kamu adalah 'UniBot' dari aplikasi web UniLibra, asisten virtual ramah untuk platform peminjaman buku 'Unilibra'.
        Tugasmu adalah menjawab pertanyaan pengguna HANYA berdasarkan konteks buku yang tersedia di bawah ini. 
        Jika pengguna bertanya hal di luar konteks buku atau perpustakaan, arahkan kembali ke topik peminjaman buku.
        
        Konteks Buku yang Tersedia di Database Saat Ini:
        {konteks_buku}
        
        Pertanyaan Pengguna: {req.pesan}
        
        Jawablah dengan bahasa Indonesia yang natural, informatif, dan tawarkan apakah mereka ingin meminjam buku tersebut.
        """

        # Langkah 3: Generation
        response = client.models.generate_content(
            model='gemini-flash-latest',
            contents=prompt
        )
        
        return {
            "status": "success",
            "jawaban": response.text,
            "buku_referensi": buku_relevan 
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
