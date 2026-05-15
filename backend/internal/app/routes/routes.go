package routes

import (
	"unilibra-backend/internal/app/controllers"
	"unilibra-backend/internal/app/middlewares"

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
		// === AREA PUBLIK (Siapa saja boleh masuk) ===
		api.POST("/register", controllers.Register)
		api.POST("/login", controllers.Login)

		// Etalase buku bisa dilihat tanpa perlu login!
		api.GET("/books", controllers.GetBooks)
		api.GET("/books/:id", controllers.GetBookByID)

		api.GET("/ai/search", controllers.SearchBooksAI)
		api.GET("/ai/similar/:id", controllers.GetSimilarBooks)
		api.GET("/ai/popular", controllers.GetPopularBooks)

		// === AREA PRIVAT (Wajib lapor Satpam / Punya JWT) ===
		protected := api.Group("/")
		protected.Use(middlewares.AuthRequired())
		{
			// Hanya user login yang bisa melakukan tindakan ini
			protected.POST("/books", controllers.CreateBook)
			protected.PUT("/books/:id", controllers.UpdateBook)    // <--- BARU (Update)
			protected.DELETE("/books/:id", controllers.DeleteBook) // <--- BARU (Delete)
		}
	}

	return r
}
