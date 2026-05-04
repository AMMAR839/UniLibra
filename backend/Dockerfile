# Gunakan image Golang versi ringan (Alpine)
FROM golang:1.26-alpine

# Set folder kerja di dalam container
WORKDIR /app

# Install Air untuk fitur Live Reload milidetik
# (Ini hanya dijalankan 1 kali berkat Docker Cache)
RUN go install github.com/air-verse/air@latest

# Salin file manajemen modul terlebih dahulu
COPY go.mod go.sum ./

# Unduh semua library yang dibutuhkan
RUN go mod download

# Salin seluruh kode sumber ke dalam container
COPY . .

# Buka port 8080 agar bisa diakses dari luar container
EXPOSE 8080

# Jalankan Air (Air yang akan mengeksekusi go build & go run di dalam container)
CMD ["air", "--build.cmd", "go build -o tmp/main cmd/unilibra/main.go", "--build.bin", "./tmp/main"]
