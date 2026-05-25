package middlewares

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" && OriginAllowed(origin) {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Vary", "Origin")
		}

		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func OriginAllowed(origin string) bool {
	for _, configuredOrigin := range allowedOrigins() {
		if configuredOrigin == "*" || configuredOrigin == origin {
			return true
		}
	}

	return false
}

func allowedOrigins() []string {
	value := os.Getenv("CORS_ALLOWED_ORIGINS")
	if value == "" {
		value = "http://localhost:5173,http://127.0.0.1:5173"
	}

	origins := make([]string, 0)
	for _, origin := range strings.Split(value, ",") {
		origin = strings.TrimSpace(origin)
		if origin != "" {
			origins = append(origins, origin)
		}
	}

	return origins
}
