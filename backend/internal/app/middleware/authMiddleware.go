package middlewares

import (
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Cek apakah user membawa header "Authorization"
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Akses ditolak: Kartu akses (Token) tidak ditemukan."})
			c.Abort() // Hentikan proses, jangan lanjut ke controller
			return
		}

		// Pisahkan kata "Bearer " dari token sebenarnya
		tokenString := strings.Replace(authHeader, "Bearer ", "", 1)

		// Validasi keaslian token menggunakan JWT_SECRET
		secretKey := os.Getenv("JWT_SECRET")
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			// Pastikan algoritma enkripsinya benar
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("metode token tidak valid")
			}
			return []byte(secretKey), nil
		})

		// Jika token tidak valid atau kadaluwarsa, tolak akses
		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Akses ditolak: Token tidak valid atau sudah kadaluarsa."})
			c.Abort()
			return
		}

		// Jika token sah, ambil data user_id dari dalamnya
		if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
			userID := claims["user_id"]
			// Titipkan user_id ini ke context Gin agar bisa dipakai oleh Controller nanti
			c.Set("userID", userID)
		}

		// Lanjut ke proses selanjutnya
		c.Next()
	}
}
