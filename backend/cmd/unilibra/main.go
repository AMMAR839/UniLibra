package main

import (
	"fmt"
	"log"

	"unilibra-backend/internal/pkg/config"

	"github.com/gin-gonic/gin"
)

func main() {
	fmt.Println("Memulai server UniLibra...")

	// Hubungkan ke database & jalankan Auto-Migrate
	config.ConnectDatabase()

	// Inisiasi framework Gin untuk membuat server HTTP
	r := gin.Default()

	// Endpoint sederhana untuk uji server
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "Server UniLibra berjalan dengan baik!",
		})
	})

	// Jalankan server di port 8080
	fmt.Println("Server berjalan di port 8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal("Gagal menjalankan server:", err)
	}
}
