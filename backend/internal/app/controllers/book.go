package controllers

import (
	"net/http"

	"unilibra-backend/internal/pkg/config"
	"unilibra-backend/internal/pkg/models"

	"github.com/gin-gonic/gin"
)

type CreateBookInput struct {
	Title       string  `json:"title" binding:"required"`
	Author      string  `json:"author" binding:"required"`
	Description string  `json:"description"`
	RentalPrice float64 `json:"rental_price" binding:"required,min=0"`
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
}

func CreateBook(c *gin.Context) {
	var input CreateBookInput

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data buku tidak lengkap: " + err.Error()})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Sesi tidak valid."})
		return
	}

	ownerID := uint(userID.(float64))

	book := models.Book{
		Title:       input.Title,
		Author:      input.Author,
		Description: input.Description,
		RentalPrice: input.RentalPrice,
		Latitude:    input.Latitude,
		Longitude:   input.Longitude,
		OwnerID:     ownerID,
		Status:      "available",
	}

	if err := config.DB.Create(&book).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan buku ke database: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Buku berhasil ditambahkan ke katalog!",
		"data":    book,
	})
}

func GetBooks(c *gin.Context) {
	var books []models.Book

	if err := config.DB.Where("status = ?", "available").Find(&books).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data katalog buku."})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Berhasil mengambil katalog buku",
		"data":    books,
	})
}

func GetBookByID(c *gin.Context) {
	bookID := c.Param("id")
	var book models.Book

	if err := config.DB.First(&book, bookID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Buku tidak ditemukan di katalog."})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Berhasil mengambil detail buku",
		"data":    book,
	})
}

func UpdateBook(c *gin.Context) {
	bookID := c.Param("id")
	var book models.Book

	if err := config.DB.First(&book, bookID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Buku tidak ditemukan"})
		return
	}

	userID, _ := c.Get("userID")
	if book.OwnerID != uint(userID.(float64)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akses ditolak: Anda bukan pemilik buku ini"})
		return
	}

	var input CreateBookInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format data tidak valid"})
		return
	}

	config.DB.Model(&book).Updates(models.Book{
		Title:       input.Title,
		Author:      input.Author,
		Description: input.Description,
		RentalPrice: input.RentalPrice,
		Latitude:    input.Latitude,
		Longitude:   input.Longitude,
	})

	c.JSON(http.StatusOK, gin.H{
		"message": "Buku berhasil diperbarui",
		"data":    book,
	})
}

func DeleteBook(c *gin.Context) {
	bookID := c.Param("id")
	var book models.Book

	if err := config.DB.First(&book, bookID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Buku tidak ditemukan"})
		return
	}

	userID, _ := c.Get("userID")
	if book.OwnerID != uint(userID.(float64)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akses ditolak: Anda bukan pemilik buku ini"})
		return
	}

	config.DB.Delete(&book)

	c.JSON(http.StatusOK, gin.H{"message": "Buku berhasil ditarik dari katalog"})
}
