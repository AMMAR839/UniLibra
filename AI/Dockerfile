FROM python:3.10-slim

WORKDIR /app

# 1. Install pustaka sistem C++ yang diwajibkan oleh PyTorch
RUN apt-get update && apt-get install -y libgomp1 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# 2. Paksa pip untuk SELALU mencari versi CPU setiap kali menginstal dependensi AI
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
