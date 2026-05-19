package routes

import (
	"unilibra-backend/internal/app/controllers"
	"unilibra-backend/internal/app/middlewares"

	"github.com/gin-gonic/gin"
)

func SetupRouter() *gin.Engine {
	r := gin.Default()

	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "Server UniLibra menyala dengan baik!",
		})
	})

	api := r.Group("/api")
	{
		api.POST("/register", controllers.Register)
		api.POST("/login", controllers.Login)

		api.GET("/books", controllers.GetBooks)
		api.GET("/books/:id", controllers.GetBookByID)

		api.GET("/ai/search", controllers.SearchBooksAI)
		api.GET("/ai/similar/:id", controllers.GetSimilarBooks)
		api.GET("/ai/popular", controllers.GetPopularBooks)

		protected := api.Group("/")
		protected.Use(middlewares.AuthRequired())
		{
			protected.GET("/profile", controllers.GetUserProfile)
			protected.PUT("/profile", controllers.UpdateUserProfile)

			protected.GET("/my-books", controllers.GetMyBooks)
			protected.GET("/transactions/borrowings", controllers.GetMyBorrowings)
			protected.GET("/transactions/lendings", controllers.GetMyLendings)

			protected.POST("/books", controllers.CreateBook)
			protected.PUT("/books/:id", controllers.UpdateBook)
			protected.DELETE("/books/:id", controllers.DeleteBook)

			protected.POST("/transactions/borrow", controllers.RequestBorrow)
			protected.PUT("/transactions/:id/respond", controllers.RespondToBorrowRequest)
			protected.PUT("/transactions/:id/return", controllers.InitiateReturn)
			protected.PUT("/transactions/:id/complete", controllers.ConfirmReturn)
		}
	}

	return r
}
