package main

import (
	"fmt"
	"log"

	"unilibra-backend/internal/app/routes"
	"unilibra-backend/internal/pkg/config"

	"github.com/joho/godotenv"
)

func main() {
	fmt.Println("Memulai server UniLibra...")

	// Load variabel dari file .env
	err := godotenv.Load()
	if err != nil {
		log.Println("Peringatan: File .env tidak ditemukan, menggunakan environment system bawaan.")
	}

	// Hubungkan ke database & jalankan Auto-Migrate
	config.ConnectDatabase()

	// Ambil daftar alamat dari folder routes
	r := routes.SetupRouter()

	// Jalankan server di port 8080
	fmt.Println("Server berjalan di port 8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal("Gagal menjalankan server:", err)
	}
}
