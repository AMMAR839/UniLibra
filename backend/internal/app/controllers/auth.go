package controllers

import (
	"net/http"

	"unilibra-backend/internal/pkg/config"
	"unilibra-backend/internal/pkg/models"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// Format data yang diharapkan dari user saat mendaftar
type RegisterInput struct {
	Name     string `json:"name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

func Register(c *gin.Context) {
	var input RegisterInput

	// Tangkap dan Validasi Input JSON dari User
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid atau kurang lengkap: " + err.Error()})
		return
	}

	// Cek apakah email sudah pernah dipakai di database
	var existingUser models.User
	if err := config.DB.Where("email = ?", input.Email).First(&existingUser).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Email sudah terdaftar, silakan gunakan email lain."})
		return
	}

	// Enkripsi (Hash) Password agar aman
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memproses kata sandi."})
		return
	}

	// Siapkan data untuk disimpan ke dalam tabel users
	newUser := models.User{
		Name:         input.Name,
		Email:        input.Email,
		PasswordHash: string(hashedPassword),
	}

	// Simpan ke Database
	if err := config.DB.Create(&newUser).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan data pengguna ke database."})
		return
	}

	// Kembalikan respon sukses
	c.JSON(http.StatusCreated, gin.H{
		"message": "Registrasi berhasil!",
		"user": gin.H{
			"id":    newUser.ID,
			"name":  newUser.Name,
			"email": newUser.Email,
		},
	})
}
