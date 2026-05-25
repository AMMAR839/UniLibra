package middlewares

import (
	"net/http"
	"strings"

	"unilibra-backend/internal/pkg/config"
	"unilibra-backend/internal/pkg/models"
	"unilibra-backend/internal/pkg/utils"

	"github.com/gin-gonic/gin"
)

func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Akses ditolak: Kartu akses (Token) tidak ditemukan."})
			c.Abort()
			return
		}

		tokenString := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
		userID, err := utils.ParseToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Akses ditolak: Token tidak valid atau sudah kadaluarsa."})
			c.Abort()
			return
		}

		c.Set("userID", float64(userID))

		c.Next()
	}
}

func AdminRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Akses admin membutuhkan sesi aktif."})
			c.Abort()
			return
		}

		var user models.User
		if err := config.DB.Select("id", "role", "status").First(&user, uint(userID.(float64))).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Pengguna tidak ditemukan."})
			c.Abort()
			return
		}

		if user.Role != "admin" || user.Status != "active" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Akses admin ditolak."})
			c.Abort()
			return
		}

		c.Next()
	}
}
