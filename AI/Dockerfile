# Gunakan image Python versi slim
FROM python:3.11-slim

# Install system dependencies (untuk psycopg2)
RUN apt-get update && apt-get install -y \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# ATURAN WAJIB HUGGING FACE: Buat user dengan ID 1000
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"

WORKDIR /app

# Salin requirements dan atur kepemilikan file
COPY --chown=user ./requirements.txt requirements.txt

# Install PyTorch CPU (Ukurannya kecil)
RUN pip install torch --index-url https://download.pytorch.org/whl/cpu

# Install sisa library
RUN pip install --no-cache-dir -r requirements.txt

# Salin file main.py dan lainnya
COPY --chown=user . /app

# Jalankan aplikasi di port 7860 (Wajib di Hugging Face)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]