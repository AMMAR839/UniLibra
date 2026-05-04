import pandas as pd
from sentence_transformers import SentenceTransformer
import psycopg2
import os

DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@127.0.0.1:5433/unilibra")

def setup_database():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    cur.execute("DROP TABLE IF EXISTS books;")
    
    cur.execute("""
        CREATE TABLE books (
            id SERIAL PRIMARY KEY,
            book_name TEXT,
            author TEXT,
            genre TEXT,
            average_rating FLOAT,
            embedding vector(384)
        );
    """)
    conn.commit()
    cur.close()
    conn.close()

def migrate_Data():
    df = pd.read_csv('Books_Data_Clean.csv')
    df['Book Name'] = df['Book Name'].fillna('')
    df['Author'] = df['Author'].fillna('')
    
    df['genre'] = df['genre'].fillna('')
    df['Book_average_rating'] = df['Book_average_rating'].fillna(0.0)

    model = SentenceTransformer('all-MiniLM-L6-v2')
    conn = psycopg2.connect(DB_URL)
    curr = conn.cursor()

    print("Memulai proses embedding. Ini akan memakan waktu beberapa menit...")
    
    for index, row in df.iterrows():
        text_to_embed = f"Buku berjudul {row['Book Name']} ditulis oleh {row['Author']} dengan genre {row['genre']}."
        embedding = model.encode(text_to_embed).tolist()
        
        curr.execute(
            """INSERT INTO books (book_name, author, genre, average_rating, embedding)
               VALUES (%s, %s, %s, %s, %s)""",
            (row['Book Name'], row['Author'], row['genre'], row['Book_average_rating'], embedding)
        )

        if index % 100 == 0 and index > 0:
            print(f"Berhasil memproses {index} buku...")
            
    conn.commit()
    curr.close()
    conn.close()
    print("Proses migrasi dari CSV ke Database Selesai!")

if __name__ == "__main__":
    setup_database()
    migrate_Data()