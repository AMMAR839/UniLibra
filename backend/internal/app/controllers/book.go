package controllers

import (
	"net/http"

	"unilibra-backend/internal/pkg/config"
	"unilibra-backend/internal/pkg/models"

	"github.com/gin-gonic/gin"
)

// Format data JSON yang diharapkan saat pengguna menambah buku
type CreateBookInput struct {
	Title       string  `json:"title" binding:"required"`
	Author      string  `json:"author" binding:"required"`
	Description string  `json:"description"`
	RentalPrice float64 `json:"rental_price" binding:"required,min=0"`
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
}

// CreateBook memproses unggahan buku baru
func CreateBook(c *gin.Context) {
	var input CreateBookInput

	// Validasi input JSON
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data buku tidak lengkap: " + err.Error()})
		return
	}

	// Ambil ID pengguna dari Middleware
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Sesi tidak valid."})
		return
	}

	// JWT mengurai angka menjadi tipe float64 secara default, kita perlu ubah jadi uint
	ownerID := uint(userID.(float64))

	// Susun data buku baru
	book := models.Book{
		Title:       input.Title,
		Author:      input.Author,
		Description: input.Description,
		RentalPrice: input.RentalPrice,
		Latitude:    input.Latitude,
		Longitude:   input.Longitude,
		OwnerID:     ownerID,
		Status:      "available", // Default otomatis tersedia saat diunggah
	}

	// Simpan ke database
	if err := config.DB.Create(&book).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan buku ke database."})
		return
	}

	// Beri respons sukses
	c.JSON(http.StatusCreated, gin.H{
		"message": "Buku berhasil ditambahkan ke katalog!",
		"data":    book,
	})
}
