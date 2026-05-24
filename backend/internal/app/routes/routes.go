package routes

import (
	"unilibra-backend/internal/app/controllers"
	"unilibra-backend/internal/app/middlewares"
	"unilibra-backend/internal/pkg/storage"

	"github.com/gin-gonic/gin"
)

func SetupRouter() *gin.Engine {
	r := gin.Default()
	r.Use(middlewares.CORS())
	r.Static("/uploads", storage.LocalUploadDir())

	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "Server UniLibra menyala dengan baik!",
		})
	})

	api := r.Group("/api")
	{
		api.POST("/register", controllers.Register)
		api.POST("/login", controllers.Login)
		api.GET("/auth/google", controllers.StartGoogleOAuth)
		api.GET("/auth/google/callback", controllers.FinishGoogleOAuth)
		api.GET("/realtime", controllers.ServeRealtime)
		api.GET("/maps/resolve", controllers.ResolveMapsLink)

		api.GET("/books", controllers.GetBooks)
		api.GET("/books/versions", controllers.GetBookVersions)
		api.GET("/books/:id", controllers.GetBookByID)

		api.GET("/ai/search", controllers.SearchBooksAI)
		api.GET("/ai/similar/:id", controllers.GetSimilarBooks)
		api.GET("/ai/popular", controllers.GetPopularBooks)
		api.POST("/ai/chat", controllers.ChatWithAI)

		protected := api.Group("/")
		protected.Use(middlewares.AuthRequired())
		{
			protected.GET("/profile", controllers.GetUserProfile)
			protected.PUT("/profile", controllers.UpdateUserProfile)

			protected.GET("/my-books", controllers.GetMyBooks)
			protected.GET("/transactions/borrowings", controllers.GetMyBorrowings)
			protected.GET("/transactions/lendings", controllers.GetMyLendings)
			protected.GET("/notifications", controllers.GetNotifications)
			protected.PUT("/notifications/read-all", controllers.ReadAllNotifications)
			protected.PUT("/notifications/:id/read", controllers.ReadNotification)

			protected.GET("/chat/threads", controllers.GetChatThreads)
			protected.POST("/chat/threads", controllers.CreateChatThread)
			protected.GET("/chat/threads/:id/messages", controllers.GetChatMessages)
			protected.POST("/chat/threads/:id/messages", controllers.PostChatMessage)

			protected.POST("/books", controllers.CreateBook)
			protected.PUT("/books/:id", controllers.UpdateBook)
			protected.DELETE("/books/:id", controllers.DeleteBook)

			protected.POST("/transactions/borrow", controllers.RequestBorrow)
			protected.PUT("/transactions/:id/respond", controllers.RespondToBorrowRequest)
			protected.PUT("/transactions/:id/return", controllers.InitiateReturn)
			protected.PUT("/transactions/:id/complete", controllers.ConfirmReturn)

			admin := protected.Group("/admin")
			admin.Use(middlewares.AdminRequired())
			{
				admin.GET("/summary", controllers.GetAdminSummary)
				admin.GET("/users", controllers.GetAdminUsers)
				admin.PATCH("/users/:id", controllers.PatchAdminUser)
				admin.GET("/books", controllers.GetAdminBooks)
				admin.PATCH("/books/:id", controllers.PatchAdminBook)
				admin.GET("/transactions", controllers.GetAdminTransactions)
				admin.GET("/reports", controllers.GetAdminReports)
			}
		}
	}

	return r
}
