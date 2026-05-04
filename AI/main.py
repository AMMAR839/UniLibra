from fastapi import FastAPI, HTTPException
from sentence_transformers import SentenceTransformer
import psycopg2
from psycopg2.extras import RealDictCursor
import os
import torch

app = FastAPI(title="Unilibra AI API", description="Sistem Rekomendasi Pencarian dan Beranda")
device = 'cuda' if torch.cuda.is_available() else 'cpu'
model = SentenceTransformer('all-MiniLM-L6-v2', device=device)
DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5433/unilibra")

def get_db_connection():
    try:
        return psycopg2.connect(DB_URL, cursor_factory=RealDictCursor)
    except Exception as e:
        print(f"Database connection error: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")

@app.get("/")
def root():
    return {"message": "Unilibra AI Engine is Running!"}

@app.get("/search")
def search_books(query: str, limit: int = 5):
    query_vector = model.encode(query).tolist()
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, book_name, author, genre, average_rating
        FROM books
        ORDER BY embedding <=> %s::vector
        LIMIT %s
    """, (query_vector, limit))
    result = cur.fetchall()
    cur.close()
    conn.close() 
    return {"query": query, "results": result}

@app.get("/recommend/similar/{book_id}")
def recommend_similar_books(book_id: int, limit: int = 5):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT embedding FROM books WHERE id = %s", (book_id,))
    target = cur.fetchone()

    if not target:
        raise HTTPException(status_code=404, detail="Buku tidak ditemukan")
        
    cur.execute("""
        SELECT id, book_name, author, genre, average_rating
        FROM books
        WHERE id != %s
        ORDER BY embedding <=> %s::vector
        LIMIT %s
    """, (book_id, target['embedding'], limit))
    recommendations = cur.fetchall()
    cur.close()
    conn.close()
    return {"recommendations": recommendations}
    
@app.get("/recommend/popular")
def get_popular_books(limit: int = 5):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, book_name, author, genre, average_rating
        FROM books
        ORDER BY average_rating DESC
        LIMIT %s
    """, (limit,))
    popular = cur.fetchall()
    cur.close()
    conn.close()
    return {"popular_books": popular}