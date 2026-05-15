import pandas as pd
from sentence_transformers import SentenceTransformer
import psycopg2
import os
from datetime import datetime

# Pastikan URL mengarah ke localhost jika dijalankan dari luar Docker, atau ke 'db' jika dari dalam
DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/unilibra")

def migrate_Data():
    # Pastikan file CSV ini ada di folder yang sama
    df = pd.read_csv('Books_Data_Clean.csv')
    df['Book Name'] = df['Book Name'].fillna('')
    df['Author'] = df['Author'].fillna('')
    df['genre'] = df['genre'].fillna('')

    model = SentenceTransformer('all-MiniLM-L6-v2')
    conn = psycopg2.connect(DB_URL)
    curr = conn.cursor()

    print("Memulai proses embedding. Ini akan memakan waktu beberapa menit...")
    
    for index, row in df.iterrows():
        # Gabungkan genre ke dalam deskripsi karena kita tidak punya kolom genre terpisah di Go
        deskripsi = f"Buku dengan genre {row['genre']}."
        text_to_embed = f"Buku berjudul {row['Book Name']} ditulis oleh {row['Author']} {deskripsi}"
        embedding = model.encode(text_to_embed).tolist()
        
        # INSERT disesuaikan dengan struktur GORM Golang!
        # Kita set owner_id = 1 (sebagai akun admin/sistem default), rental_price = 5000
        curr.execute(
            """INSERT INTO books (title, author, description, owner_id, rental_price, status, embedding, created_at, updated_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (row['Book Name'], row['Author'], deskripsi, 1, 5000.0, 'available', embedding, datetime.now(), datetime.now())
        )

        if index % 100 == 0 and index > 0:
            print(f"Berhasil memproses {index} buku...")
            
    conn.commit()
    curr.close()
    conn.close()
    print("Proses migrasi dari CSV ke Database Selesai!")

if __name__ == "__main__":
    migrate_Data()
