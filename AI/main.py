import os
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI, Header, HTTPException
from sentence_transformers import SentenceTransformer
from google import genai
from pydantic import BaseModel
import torch
from math import asin, cos, radians, sin, sqrt

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
    latitude: float | None = None
    longitude: float | None = None

class BookEmbeddingRequest(BaseModel):
    book_id: int

# --- 2. FUNGSI UTILITAS ---
def get_db_connection():
    try:
        return psycopg2.connect(DB_URL, cursor_factory=RealDictCursor)
    except Exception as e:
        print(f"Database connection error: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")

def is_catalog_count_question(message):
    normalized = message.lower()
    has_count_intent = any(
        keyword in normalized
        for keyword in [
            "berapa banyak",
            "jumlah",
            "total",
            "ada berapa",
            "berapa buku",
        ]
    )
    has_book_context = any(
        keyword in normalized
        for keyword in ["buku", "katalog", "unilibra", "tersedia"]
    )
    return has_count_intent and has_book_context

def get_catalog_stats():
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT
              COUNT(*) AS available_books,
              COUNT(DISTINCT LOWER(TRIM(title))) AS available_titles
            FROM books
            WHERE status = 'available'
        """)
        stats = dict(cur.fetchone())

        cur.execute("""
            SELECT category, COUNT(*) AS total
            FROM books
            WHERE status = 'available'
              AND COALESCE(NULLIF(TRIM(category), ''), '') <> ''
            GROUP BY category
            ORDER BY total DESC, category ASC
            LIMIT 5
        """)
        stats["top_categories"] = [dict(row) for row in cur.fetchall()]
        return stats
    finally:
        cur.close()
        conn.close()

def build_catalog_count_answer(stats):
    categories = stats.get("top_categories") or []
    category_line = ""
    if categories:
        category_line = "\nKategori terbanyak: " + ", ".join(
            f"{item['category']} ({item['total']})" for item in categories[:3]
        ) + "."

    return (
        f"Saat ini ada {stats['available_books']} buku tersedia di UniLibra, "
        f"dari sekitar {stats['available_titles']} judul berbeda."
        f"{category_line}\n"
        "Untuk melihat semuanya, buka halaman Katalog Buku atau cari judul/genre tertentu di sini."
    )

# Pengganti cari_buku_relevan: Digunakan oleh /search dan /api/chat
def calculate_distance_km(origin_lat, origin_lng, book):
    if origin_lat is None or origin_lng is None:
        return None
    book_lat = book.get("latitude")
    book_lng = book.get("longitude")
    if not book_lat or not book_lng:
        return None

    lat1, lng1, lat2, lng2 = map(radians, [origin_lat, origin_lng, book_lat, book_lng])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    value = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2
    return round(6371 * 2 * asin(sqrt(value)), 2)

def execute_semantic_search(query_text, limit=5, latitude=None, longitude=None):
    query_vector = ai_model.encode(query_text).tolist()
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id, title, author, description, category, theme, rental_price,
                   status, cover_url, owner_id, location, latitude, longitude
            FROM books
            WHERE status = 'available'
              AND embedding IS NOT NULL
            ORDER BY embedding <=> %s::vector
            LIMIT %s
        """, (query_vector, max(limit, 40)))
        results = [dict(book) for book in cur.fetchall()]

        normalized_query = "".join(query_text.lower().split())
        cur.execute("""
            SELECT id, title, author, description, category, theme, rental_price,
                   status, cover_url, owner_id, location, latitude, longitude
            FROM books
            WHERE status = 'available'
            ORDER BY updated_at DESC
            LIMIT 200
        """)
        catalog_books = [dict(book) for book in cur.fetchall()]
        exact_books = []
        fuzzy_books = []
        for book in catalog_books:
            compact_haystack = "".join(" ".join([
                str(book.get("title") or ""),
                str(book.get("author") or ""),
                str(book.get("category") or ""),
                str(book.get("theme") or ""),
                str(book.get("location") or ""),
            ]).lower().split())
            if normalized_query and normalized_query in compact_haystack:
                exact_books.append(book)

        if normalized_query:
            cur.execute("""
                SELECT id, title, author, description, category, theme, rental_price,
                       status, cover_url, owner_id, location, latitude, longitude,
                       GREATEST(
                         similarity(LOWER(title), LOWER(%s)),
                         similarity(LOWER(author), LOWER(%s)),
                         word_similarity(LOWER(%s), LOWER(title)),
                         word_similarity(LOWER(%s), LOWER(author)),
                         word_similarity(
                           LOWER(%s),
                           LOWER(COALESCE(category, '') || ' ' || COALESCE(theme, '') || ' ' || COALESCE(description, ''))
                         )
                       ) AS fuzzy_score
                FROM books
                WHERE status = 'available'
                  AND (
                    similarity(LOWER(title), LOWER(%s)) > 0.18
                    OR similarity(LOWER(author), LOWER(%s)) > 0.2
                    OR word_similarity(LOWER(%s), LOWER(title)) > 0.28
                    OR word_similarity(LOWER(%s), LOWER(author)) > 0.28
                    OR word_similarity(
                      LOWER(%s),
                      LOWER(COALESCE(category, '') || ' ' || COALESCE(theme, '') || ' ' || COALESCE(description, ''))
                    ) > 0.24
                  )
                ORDER BY fuzzy_score DESC, updated_at DESC
                LIMIT 40
            """, (
                query_text,
                query_text,
                query_text,
                query_text,
                query_text,
                query_text,
                query_text,
                query_text,
                query_text,
                query_text,
            ))
            fuzzy_books = [dict(book) for book in cur.fetchall()]

        merged_results = []
        seen_ids = set()
        for book in exact_books + fuzzy_books + results:
            if book["id"] in seen_ids:
                continue
            seen_ids.add(book["id"])
            merged_results.append(book)

        if not merged_results and latitude is not None and longitude is not None:
            merged_results = catalog_books

        for book in merged_results:
            book["distance_km"] = calculate_distance_km(latitude, longitude, book)
            haystack = " ".join([
                str(book.get("title") or ""),
                str(book.get("author") or ""),
                str(book.get("category") or ""),
                str(book.get("theme") or ""),
                str(book.get("location") or ""),
            ]).lower()
            compact_haystack = "".join(haystack.split())
            book["exact_match"] = bool(normalized_query and normalized_query in compact_haystack)

        if latitude is not None and longitude is not None:
            merged_results.sort(key=lambda book: (
                not book["exact_match"],
                book["distance_km"] is None,
                book["distance_km"] if book["distance_km"] is not None else 999999,
            ))
        else:
            merged_results.sort(key=lambda book: (not book["exact_match"],))

        return merged_results[:limit]
    finally:
        cur.close()
        conn.close()

def embedding_text(book):
    return " ".join(
        value for value in [
            book.get("title", ""),
            book.get("author", ""),
            book.get("category", ""),
            book.get("theme", ""),
            book.get("location", ""),
            book.get("description", ""),
        ] if value
    )

def book_line(book):
    distance = ""
    if book.get("distance_km") is not None:
        distance = f" - sekitar {book['distance_km']} km dari kamu"
    price = book.get("rental_price") or 0
    return (
        f"{book['title']} oleh {book['author']} | "
        f"{book.get('category') or 'Kategori belum diisi'} | "
        f"{book.get('theme') or 'Tema belum diisi'} | "
        f"{book.get('location') or 'Lokasi belum diisi'}{distance} | "
        f"Rp {int(price):,}/minggu"
    ).replace(",", ".")

def build_chat_fallback_answer(message, books, has_location):
    if not books:
        return (
            "Aku belum menemukan buku yang cocok.\n"
            "Coba sebutkan judul, penulis, genre, atau area yang lebih spesifik."
        )

    recommendations = []
    for index, book in enumerate(books[:3], 1):
        distance = ""
        if book.get("distance_km") is not None:
            distance = f" - sekitar {book['distance_km']} km"
        recommendations.append(
            f"{index}. {book['title']} - {book['author']}\n"
            f"   {book.get('location') or 'Lokasi belum diisi'}{distance}\n"
            f"   Rp {int(book.get('rental_price') or 0):,}/minggu".replace(",", ".")
        )

    return (
        f"Aku menemukan {len(books)} buku yang cocok"
        + (" dan dekat dari lokasimu." if has_location else ".")
        + "\n\n"
        + "\n\n".join(recommendations)
        + "\n\nPilih salah satu kartu buku di bawah untuk lanjut meminjam."
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
            SELECT id, title, author, description, category, theme, rental_price,
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
            SELECT b.id, b.title, b.author, b.description, b.category, b.theme,
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
            SELECT id, title, author, description, category, theme, location
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
        if is_catalog_count_question(req.pesan):
            stats = get_catalog_stats()
            popular_books = get_popular_books(limit=4)["popular_books"]
            return {
                "status": "success",
                "jawaban": build_catalog_count_answer(stats),
                "buku_referensi": popular_books,
                "actions": [
                    {"label": f"Pinjam {b['title']}", "book_id": b["id"], "path": f"/meminjam?book={b['id']}"}
                    for b in popular_books[:3]
                ],
                "engine": "database-count",
            }

        # Langkah 1: Retrieval (Menggunakan fungsi utilitas yang sama dengan /search)
        buku_relevan = execute_semantic_search(
            req.pesan,
            limit=12,
            latitude=req.latitude,
            longitude=req.longitude,
        )
        
        konteks_buku = ""
        if buku_relevan:
            for idx, b in enumerate(buku_relevan, 1):
                konteks_buku += f"{idx}. {book_line(b)}\n"
        else:
            konteks_buku = "Tidak ada buku spesifik yang relevan di database."

        if client is None:
            return {
                "status": "success",
                "jawaban": build_chat_fallback_answer(
                    req.pesan,
                    buku_relevan,
                    req.latitude is not None and req.longitude is not None,
                ),
                "buku_referensi": buku_relevan,
                "actions": [
                    {"label": f"Pinjam {b['title']}", "book_id": b["id"], "path": f"/meminjam?book={b['id']}"}
                    for b in buku_relevan[:3]
                ],
                "engine": "semantic-fallback",
            }

        # Langkah 2: Augmented Prompt
        prompt = f"""
        Kamu adalah 'UniBot' dari aplikasi web UniLibra, asisten virtual ramah untuk platform peminjaman buku 'Unilibra'.
        Tugasmu adalah menjawab pertanyaan pengguna HANYA berdasarkan konteks buku yang tersedia di bawah ini. 
        Jika pengguna bertanya hal di luar konteks buku atau perpustakaan, arahkan kembali ke topik peminjaman buku.
        Jika ada lokasi pengguna dan distance_km, prioritaskan buku yang paling dekat.
        Jika pengguna bertanya apakah buku/penulis tertentu masih ada, jawab berdasarkan status buku di konteks.
        Jangan mengarang buku di luar konteks.
        
        Konteks Buku yang Tersedia di Database Saat Ini:
        {konteks_buku}

        Catatan penting:
        - Konteks di atas hanya potongan hasil pencarian, bukan seluruh jumlah buku di database.
        - Jika pengguna bertanya total/jumlah semua buku, jangan simpulkan dari jumlah item konteks.
        
        Pertanyaan Pengguna: {req.pesan}
        
        Gaya jawaban:
        - Bahasa Indonesia singkat, rapi, dan langsung membantu.
        - Jangan pakai markdown tebal, emoji, heading panjang, atau sapaan berlebihan.
        - Maksimal 4 poin rekomendasi.
        - Format tiap rekomendasi: Judul - Penulis, lokasi/jarak jika ada, harga per minggu.
        - Akhiri dengan satu kalimat ajakan memilih kartu buku di bawah.
        """

        # Langkah 3: Generation
        response = client.models.generate_content(
            model='gemini-flash-latest',
            contents=prompt
        )
        
        return {
            "status": "success",
            "jawaban": response.text,
            "buku_referensi": buku_relevan,
            "actions": [
                {"label": f"Pinjam {b['title']}", "book_id": b["id"], "path": f"/meminjam?book={b['id']}"}
                for b in buku_relevan[:3]
            ],
            "engine": "gemini",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
