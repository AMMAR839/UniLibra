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

// GetBooks mengambil daftar semua buku yang statusnya tersedia
func GetBooks(c *gin.Context) {
	var books []models.Book

	// Ambil semua buku dari database yang statusnya 'available'
	// Nanti di Fase 4, kita akan menambahkan logika pencarian ML dan lokasi di sini!
	if err := config.DB.Where("status = ?", "available").Find(&books).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data katalog buku."})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Berhasil mengambil katalog buku",
		"data":    books,
	})
}

// GetBookByID mengambil detail spesifik dari satu buku beserta informasi pemiliknya
func GetBookByID(c *gin.Context) {
	// Ambil angka ID dari URL (misal: /api/books/1)
	bookID := c.Param("id")
	var book models.Book

	// Cari buku berdasarkan ID
	if err := config.DB.First(&book, bookID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Buku tidak ditemukan di katalog."})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Berhasil mengambil detail buku",
		"data":    book,
	})
}

// UpdateBook mengubah data buku yang sudah ada di etalase
func UpdateBook(c *gin.Context) {
	bookID := c.Param("id")
	var book models.Book

	// 1. Cek apakah buku itu ada di database?
	if err := config.DB.First(&book, bookID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Buku tidak ditemukan"})
		return
	}

	// 2. KEAMANAN: Pastikan yang mau mengedit adalah pemilik asli bukunya!
	userID, _ := c.Get("userID")
	if book.OwnerID != uint(userID.(float64)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akses ditolak: Anda bukan pemilik buku ini"})
		return
	}

	// 3. Tangkap data baru yang dikirim user
	var input CreateBookInput // Kita pakai wadah input yang sama dengan Create
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format data tidak valid"})
		return
	}

	// 4. Lakukan pembaruan data
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

// DeleteBook menghapus buku dari katalog
func DeleteBook(c *gin.Context) {
	bookID := c.Param("id")
	var book models.Book

	// 1. Cek apakah bukunya ada?
	if err := config.DB.First(&book, bookID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Buku tidak ditemukan"})
		return
	}

	// 2. KEAMANAN: Pastikan yang mau menghapus adalah pemiliknya!
	userID, _ := c.Get("userID")
	if book.OwnerID != uint(userID.(float64)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akses ditolak: Anda bukan pemilik buku ini"})
		return
	}

	// 3. Hapus bukunya!
	// (GORM secara otomatis akan melakukan "Soft Delete" berkat gorm.Model,
	// datanya disembunyikan tapi tidak benar-benar hilang dari hard-disk untuk mencegah kehilangan data fatal).
	config.DB.Delete(&book)

	c.JSON(http.StatusOK, gin.H{"message": "Buku berhasil ditarik dari katalog"})
}
