package routes

import (
	"unilibra-backend/internal/app/controllers"

	"github.com/gin-gonic/gin"
)

// Fungsi untuk mendaftarkan semua alamat API (Endpoint)
func SetupRouter() *gin.Engine {
	// Inisialisasi router bawaan Gin
	r := gin.Default()

	// Endpoint untuk mengecek apakah server hidup
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "Server UniLibra menyala dengan baik!",
		})
	})

	// Kelompok alamat untuk API
	api := r.Group("/api")
	{
		// Mendaftarkan alamat /api/register yang mengarah ke fungsi Register
		api.POST("/register", controllers.Register)
		
		// Mendaftarkan alamat /api/login yang mengarah ke fungsi Login
		api.POST("/login", controllers.Login)
	}

	return r
}
