package main

import (
	"fmt"
	"log"
	"os"

	"unilibra-backend/internal/app/routes"
	"unilibra-backend/internal/pkg/config"

	"github.com/joho/godotenv"
)

func main() {
	fmt.Println("Memulai server UniLibra...")

	err := godotenv.Load()
	if err != nil {
		log.Println("Peringatan: File .env tidak ditemukan, menggunakan environment system bawaan.")
	}

	config.ConnectDatabase()

	r := routes.SetupRouter()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080" // Fallback ke 8080 jika dijalankan lokal di laptop
	}

	fmt.Printf("Server berjalan di port %s\n", port)

	// Gunakan variabel port untuk menjalankan server
	if err := r.Run(":" + port); err != nil {
		log.Fatal("Gagal menjalankan server:", err)
	}
}
