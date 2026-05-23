import pandas as pd
from sentence_transformers import SentenceTransformer
import psycopg2
import os
from datetime import datetime

# Pastikan URL mengarah ke localhost jika dijalankan dari luar Docker, atau ke 'db' jika dari dalam
DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/unilibra")
SEED_OWNER_EMAIL = os.getenv("AI_SEED_OWNER_EMAIL", "dataset@unilibra.local")

def migrate_Data():
    # Pastikan file CSV ini ada di folder yang sama
    df = pd.read_csv('Books_Data_Clean.csv')
    df['Book Name'] = df['Book Name'].fillna('')
    df['Author'] = df['Author'].fillna('')
    df['genre'] = df['genre'].fillna('')

    model = SentenceTransformer('all-MiniLM-L6-v2')
    conn = psycopg2.connect(DB_URL)
    curr = conn.cursor()
    owner_id = ensure_seed_owner(curr)

    print("Memulai proses embedding. Ini akan memakan waktu beberapa menit...")
    
    for index, row in df.iterrows():
        deskripsi = f"Buku dengan genre {row['genre']}."
        text_to_embed = f"Buku berjudul {row['Book Name']} ditulis oleh {row['Author']} bertema {row['genre']} {deskripsi}"
        embedding = model.encode(text_to_embed).tolist()
        
        curr.execute(
            """INSERT INTO books (title, author, description, category, theme, owner_id, rental_price, status, embedding, created_at, updated_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (row['Book Name'], row['Author'], deskripsi, row['genre'], row['genre'], owner_id, 5000.0, 'available', embedding, datetime.now(), datetime.now())
        )

        if index % 100 == 0 and index > 0:
            print(f"Berhasil memproses {index} buku...")
            
    conn.commit()
    curr.close()
    conn.close()
    print("Proses migrasi dari CSV ke Database Selesai!")

def ensure_seed_owner(curr):
    curr.execute(
        """INSERT INTO users (name, email, role, status, created_at, updated_at)
           VALUES (%s, %s, %s, %s, %s, %s)
           ON CONFLICT (email) DO UPDATE SET updated_at = EXCLUDED.updated_at
           RETURNING id""",
        ("Dataset UniLibra", SEED_OWNER_EMAIL, "user", "active", datetime.now(), datetime.now())
    )
    return curr.fetchone()[0]

if __name__ == "__main__":
    migrate_Data()
