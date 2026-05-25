import os

from google import genai


api_key = os.getenv("GEMINI_API")
if not api_key:
    raise RuntimeError("Set GEMINI_API sebelum menjalankan cek_modul.py")

client = genai.Client(api_key=api_key)

print("Daftar model yang BISA digunakan oleh API Key Anda:")
print("-" * 50)

# Mengambil daftar model dari server
try:
    for model in client.models.list():
        print(f"- {model.name}")
except Exception as e:
    print(f"Gagal mengambil data. Error: {e}")
