package controllers

import (
	"net/http"
	"os"
	"strings"

	"unilibra-backend/internal/pkg/config"
	"unilibra-backend/internal/pkg/models"
	"unilibra-backend/internal/pkg/utils"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type RegisterInput struct {
	Name     string `json:"name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	City     string `json:"city"`
}

func Register(c *gin.Context) {
	var input RegisterInput

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak valid atau kurang lengkap: " + err.Error()})
		return
	}

	var existingUser models.User
	if err := config.DB.Where("email = ?", input.Email).First(&existingUser).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Email sudah terdaftar, silakan gunakan email lain."})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memproses kata sandi."})
		return
	}

	newUser := models.User{
		Name:         input.Name,
		Email:        input.Email,
		PasswordHash: string(hashedPassword),
		City:         input.City,
		Role:         roleForEmail(input.Email),
		Status:       "active",
	}

	if err := config.DB.Create(&newUser).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan data pengguna ke database."})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Registrasi berhasil!",
		"user": gin.H{
			"id":     newUser.ID,
			"name":   newUser.Name,
			"email":  newUser.Email,
			"role":   newUser.Role,
			"status": newUser.Status,
		},
	})
}

type LoginInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

func Login(c *gin.Context) {
	var input LoginInput

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email dan password wajib diisi dengan benar."})
		return
	}

	var user models.User
	if err := config.DB.Where("email = ?", input.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Email atau password salah."})
		return
	}
	if user.Status == "suspended" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akun sedang dinonaktifkan."})
		return
	}
	if user.Role == "" || roleForEmail(user.Email) == "admin" && user.Role != "admin" {
		user.Role = roleForEmail(user.Email)
		if user.Status == "" {
			user.Status = "active"
		}
		config.DB.Save(&user)
	}

	err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Email atau password salah."})
		return
	}

	token, err := utils.GenerateToken(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat token autentikasi."})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Login berhasil!",
		"token":   token,
		"user": gin.H{
			"id":     user.ID,
			"name":   user.Name,
			"email":  user.Email,
			"role":   user.Role,
			"status": user.Status,
		},
	})
}

func roleForEmail(email string) string {
	normalizedEmail := strings.TrimSpace(strings.ToLower(email))
	for _, configuredEmail := range strings.Split(os.Getenv("ADMIN_EMAILS"), ",") {
		if strings.TrimSpace(strings.ToLower(configuredEmail)) == normalizedEmail {
			return "admin"
		}
	}

	return "user"
}
