FROM python:3.10-slim

WORKDIR /app

# 1. Install pustaka sistem (termasuk build-essential jaga-jaga jika ada modul C yang kurang)
RUN apt-get update && apt-get install -y libgomp1 build-essential && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# 2. Paksa pip mengabaikan cache lama dan menggunakan timeout lebih panjang
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir --default-timeout=100 -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
