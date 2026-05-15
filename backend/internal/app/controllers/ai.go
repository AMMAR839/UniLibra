package controllers

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"

	"github.com/gin-gonic/gin"
)

func getAIURL() string {
	url := os.Getenv("AI_ENGINE_URL")
	if url == "" {
		return "http://ai-engine:8000"
	}
	return url
}

func SearchBooksAI(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter pencarian 'q' wajib diisi"})
		return
	}

	encodedQuery := url.QueryEscape(query)

	targetURL := fmt.Sprintf("%s/search?query=%s", getAIURL(), encodedQuery)

	forwardRequestToAI(c, targetURL)
}

func GetSimilarBooks(c *gin.Context) {
	bookID := c.Param("id")
	targetURL := fmt.Sprintf("%s/recommend/similar/%s", getAIURL(), bookID)
	forwardRequestToAI(c, targetURL)
}

func GetPopularBooks(c *gin.Context) {
	targetURL := fmt.Sprintf("%s/recommend/popular", getAIURL())
	forwardRequestToAI(c, targetURL)
}

func forwardRequestToAI(c *gin.Context, targetURL string) {
	resp, err := http.Get(targetURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal terhubung ke AI Engine"})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca balasan dari AI Engine"})
		return
	}

	c.Data(resp.StatusCode, "application/json", body)
}
