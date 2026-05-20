from google import genai

# Ganti dengan API Key Anda yang diawali AIzaSy...
API_KEY = "AIzaSyAdrdA53mGj-iGCuX_TYTh5rjsbzmeajNA"

# Inisialisasi menggunakan format SDK terbaru
client = genai.Client(api_key=API_KEY)

print("Daftar model yang BISA digunakan oleh API Key Anda:")
print("-" * 50)

# Mengambil daftar model dari server
try:
    for model in client.models.list():
        print(f"- {model.name}")
except Exception as e:
    print(f"Gagal mengambil data. Error: {e}")