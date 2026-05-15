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

	err := godotenv.Load()
	if err != nil {
		log.Println("Peringatan: File .env tidak ditemukan, menggunakan environment system bawaan.")
	}

	config.ConnectDatabase()

	r := routes.SetupRouter()

	fmt.Println("Server berjalan di port 8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal("Gagal menjalankan server:", err)
	}
}
