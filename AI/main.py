import os
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI, Header, HTTPException
from sentence_transformers import SentenceTransformer
from pydantic import BaseModel
import torch
from math import asin, cos, radians, sin, sqrt
import google.generativeai as genai

app = FastAPI(title="Unilibra AI API", description="Sistem rekomendasi dan pencarian semantik terintegrasi Gemini")
load_dotenv()

# --- 1. INISIALISASI MODEL & KONFIGURASI ---
device = 'cuda' if torch.cuda.is_available() else 'cpu'
# Cukup 1 model untuk seluruh aplikasi (Lebih hemat RAM/VRAM)
ai_model = SentenceTransformer('all-MiniLM-L6-v2', device=device)

DB_URL = os.getenv("DATABASE_URL")
AI_INTERNAL_TOKEN = os.getenv("AI_INTERNAL_TOKEN")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# Konfigurasi Gemini
if not GEMINI_API_KEY:
    print("WARNING: GEMINI_API_KEY belum terpasang!")
else:
    genai.configure(api_key=GEMINI_API_KEY)

class ChatRequest(BaseModel):
    pesan: str
    latitude: float | None = None
    longitude: float | None = None

class BookEmbeddingRequest(BaseModel):
    book_id: int

# --- 2. FUNGSI UTILITAS (Dipertahankan Persis Seperti Aslinya) ---
def get_db_connection():
    try:
        return psycopg2.connect(database_url(), cursor_factory=RealDictCursor)
    except Exception as e:
        print(f"Database connection error: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")

def database_url():
    if not DB_URL:
        return DB_URL
    if "supabase.com" in DB_URL and "sslmode=" not in DB_URL:
        separator = "&" if "?" in DB_URL else "?"
        return DB_URL + separator + "sslmode=require"
    return DB_URL

def is_catalog_count_question(message):
    normalized = message.lower()
    has_count_intent = any(
        keyword in normalized
        for keyword in ["berapa banyak", "jumlah", "total", "ada berapa", "berapa buku"]
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
    # Logika Fuzzy, Spasial, dan Vektor dipertahankan utuh
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
                query_text, query_text, query_text, query_text, query_text,
                query_text, query_text, query_text, query_text, query_text,
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
            title_text = str(book.get("title") or "").lower()
            author_text = str(book.get("author") or "").lower()
            haystack = " ".join([
                title_text, author_text,
                str(book.get("category") or ""),
                str(book.get("theme") or ""),
                str(book.get("location") or ""),
            ]).lower()
            compact_haystack = "".join(haystack.split())
            compact_title = "".join(title_text.split())
            compact_author = "".join(author_text.split())
            book["exact_match"] = bool(normalized_query and normalized_query in compact_haystack)
            if normalized_query and compact_title == normalized_query:
                book["match_rank"] = 0
            elif normalized_query and compact_title.startswith(normalized_query):
                book["match_rank"] = 1
            elif normalized_query and normalized_query in compact_title:
                book["match_rank"] = 2
            elif normalized_query and compact_author == normalized_query:
                book["match_rank"] = 3
            elif normalized_query and normalized_query in compact_author:
                book["match_rank"] = 4
            elif book["exact_match"]:
                book["match_rank"] = 5
            else:
                book["match_rank"] = 6

        if latitude is not None and longitude is not None:
            merged_results.sort(key=lambda book: (
                book["match_rank"],
                book["distance_km"] is None,
                book["distance_km"] if book["distance_km"] is not None else 999999,
            ))
        else:
            merged_results.sort(key=lambda book: (book["match_rank"],))

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
        distance = f" - sekitar {book['distance_km']} km"
    price = book.get("rental_price") or 0
    return (
        f"{book['title']} - {book['author']} | "
        f"{book.get('category') or 'Kategori umum'} | "
        f"{book.get('location') or 'Lokasi belum diisi'}{distance} | "
        f"Rp {int(price):,}/minggu".replace(",", ".")
    )

def retrieval_query_for_message(message):
    normalized = message.lower()
    if any(word in normalized for word in ["sedih", "galau", "kecewa", "patah hati", "capek hati"]):
        return "novel romance sastra pengembangan diri refleksi hangat"
    if any(word in normalized for word in ["stres", "stress", "cemas", "overthinking", "burnout", "lelah"]):
        return "pengembangan diri psikologi kebiasaan tenang refleksi"
    if any(word in normalized for word in ["motivasi", "semangat", "produktif", "malas", "bingung mulai"]):
        return "motivasi produktivitas kebiasaan pengembangan diri"
    return message

def require_internal_token(token):
    if AI_INTERNAL_TOKEN and token != AI_INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="AI internal token tidak valid")

# --- 2.5 FITUR BARU: INTENT ROUTER GEMINI ---
def classify_intent(message: str) -> str:
    """Mengklasifikasikan niat pengguna untuk menghemat pemanggilan database."""
    if not GEMINI_API_KEY:
        return "A"
        
    prompt = f"""
    Klasifikasikan pertanyaan pengguna ini ke dalam dua kategori:
    Kategori A: Pengguna mencari buku, meminta rekomendasi, atau membahas peminjaman perpustakaan.
    Kategori B: Pengguna menyapa (Halo), bertanya fakta umum (Siapa presiden), atau membahas hal di luar buku/perpustakaan.

    Pertanyaan: "{message}"

    Jawab HANYA dengan huruf 'A' atau 'B'.
    """
    try:
        model = genai.GenerativeModel(GEMINI_MODEL)
        response = model.generate_content(prompt)
        return response.text.strip().upper()
    except Exception:
        return "A"

# --- 3. ENDPOINT API ---

@app.get("/")
def root():
    return {"message": "Unilibra AI Engine is Running with Gemini!"}

@app.get("/health")
def health():
    return {
        "status": "ok",
        "device": device,
        "embedding_model": "all-MiniLM-L6-v2",
        "ai_engine": GEMINI_MODEL
    }

@app.get("/search")
def search_books(query: str, limit: int = 5, latitude: float | None = None, longitude: float | None = None):
    results = execute_semantic_search(query, limit, latitude, longitude)
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
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="Gemini API Key belum dikonfigurasi")

    try:
        # Fitur bawaan: Menjawab jumlah katalog secara cepat
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

        # LANGKAH 1: Deteksi Niat (Intent Routing)
        intent = classify_intent(req.pesan)

        # JIKA INTENT B (Sapaan / Luar Topik)
        if "B" in intent:
            system_instruction_fallback = (
                "Kamu adalah UniBot, asisten perpustakaan UniLibra. "
                "Jawab sapaan dengan ramah, tapi tolak dengan sopan semua pertanyaan fakta umum, "
                "bantuan coding, atau hal di luar buku. Arahkan pengguna kembali untuk mencari buku."
            )
            model_fallback = genai.GenerativeModel(
                model_name=GEMINI_MODEL,
                system_instruction=system_instruction_fallback
            )
            response = model_fallback.generate_content(req.pesan)
            return {
                "status": "success",
                "jawaban": response.text.strip(),
                "buku_referensi": [],
                "actions": [],
                "engine": "gemini-intent-b"
            }

        # JIKA INTENT A (Cari Buku / Rekomendasi)
        retrieval_query = retrieval_query_for_message(req.pesan)
        buku_relevan = execute_semantic_search(
            retrieval_query,
            limit=12,
            latitude=req.latitude,
            longitude=req.longitude,
        )
        
        konteks_buku = ""
        if buku_relevan:
            for idx, b in enumerate(buku_relevan, 1):
                konteks_buku += f"{idx}. {book_line(b)}\n"
        else:
            konteks_buku = "Tidak ada buku spesifik yang relevan di database saat ini."

        # LANGKAH 2: Guardrail System Instruction untuk Gemini
        system_instruction_rag = f"""
        Kamu adalah 'UniBot', asisten virtual ramah untuk platform peminjaman buku 'Unilibra'.
        Tugas utamamu adalah menjawab berdasarkan konteks buku di bawah ini.
        Jika ada lokasi pengguna (ditandai dengan 'sekitar X km'), prioritaskan buku yang terdekat.
        
        Konteks Buku yang Tersedia:
        {konteks_buku}
        
        Gaya jawaban:
        - Bahasa Indonesia singkat, rapi, dan langsung membantu.
        - Jangan pakai markdown tebal, emoji, heading panjang, atau sapaan berlebihan.
        - Maksimal 4 poin rekomendasi.
        - Format rekomendasi: Judul - Penulis, lokasi (jarak), harga/minggu.
        - Akhiri dengan kalimat: "Pilih salah satu kartu buku di bawah untuk lanjut meminjam."
        """

        model_rag = genai.GenerativeModel(
            model_name=GEMINI_MODEL,
            system_instruction=system_instruction_rag
        )
        response = model_rag.generate_content(req.pesan)

        return {
            "status": "success",
            "jawaban": response.text.strip(),
            "buku_referensi": buku_relevan,
            "actions": [
                {"label": f"Pinjam {b['title']}", "book_id": b["id"], "path": f"/meminjam?book={b['id']}"}
                for b in buku_relevan[:3]
            ],
            "engine": "gemini-intent-a-rag",
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
