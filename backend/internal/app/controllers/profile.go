package controllers

import (
	"net/http"

	"unilibra-backend/internal/pkg/config"
	"unilibra-backend/internal/pkg/models"

	"github.com/gin-gonic/gin"
)

func GetUserProfile(c *gin.Context) {
	userID, _ := c.Get("userID")
	var user models.User

	if err := config.DB.First(&user, userID.(uint)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pengguna tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Profil berhasil diambil",
		"data":    user,
	})
}

type UpdateProfileInput struct {
	Name        string  `json:"name"`
	PhoneNumber string  `json:"phone_number"`
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
}

func UpdateUserProfile(c *gin.Context) {
	userID, _ := c.Get("userID")
	var user models.User

	if err := config.DB.First(&user, userID.(uint)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pengguna tidak ditemukan"})
		return
	}

	var input UpdateProfileInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format data tidak valid"})
		return
	}

	config.DB.Model(&user).Updates(models.User{
		Name:        input.Name,
		PhoneNumber: input.PhoneNumber,
		Latitude:    input.Latitude,
		Longitude:   input.Longitude,
	})

	user.PasswordHash = ""
	c.JSON(http.StatusOK, gin.H{
		"message": "Profil berhasil diperbarui",
		"data":    user,
	})
}

// GetMyBooks digunakan untuk fitur "Toko", mengambil buku milik user
func GetMyBooks(c *gin.Context) {
	userID, _ := c.Get("userID")
	var books []models.Book

	if err := config.DB.Preload("Owner").Where("owner_id = ?", userID.(uint)).Find(&books).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar buku Anda"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Buku Anda berhasil diambil",
		"data":    books,
	})
}

// GetMyBorrowings mengambil history peminjaman user
func GetMyBorrowings(c *gin.Context) {
	userID, _ := c.Get("userID")
	var transactions []models.Transaction

	if err := config.DB.Preload("Book").Preload("Book.Owner").Preload("Borrower").
		Where("borrower_id = ?", userID.(uint)).
		Order("created_at DESC").
		Find(&transactions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil riwayat peminjaman"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Riwayat peminjaman berhasil diambil",
		"data":    transactions,
	})
}

// GetMyLendings mengambil history pesanan pada buku yang dipinjamkan user
func GetMyLendings(c *gin.Context) {
	userID, _ := c.Get("userID")
	var transactions []models.Transaction

	// Join dengan tabel books untuk mendapatkan transaksi dari buku milik user
	err := config.DB.Preload("Book").Preload("Book.Owner").Preload("Borrower").
		Joins("JOIN books ON transactions.book_id = books.id").
		Where("books.owner_id = ?", userID.(uint)).
		Order("transactions.created_at DESC").
		Find(&transactions).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil riwayat penyewaan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Riwayat penyewaan berhasil diambil",
		"data":    transactions,
	})
}
