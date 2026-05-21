package controllers

import (
	"bytes"
	"encoding/json"
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

	forwardRequestToAI(c, targetURL, func() {
		writeBookFallback(c, query, "AI belum tersedia. Katalog biasa ditampilkan.")
	})
}

func GetSimilarBooks(c *gin.Context) {
	bookID := c.Param("id")
	targetURL := fmt.Sprintf("%s/recommend/similar/%s", getAIURL(), bookID)
	forwardRequestToAI(c, targetURL, func() {
		writeBookFallback(c, "", "Rekomendasi serupa belum tersedia.")
	})
}

func GetPopularBooks(c *gin.Context) {
	targetURL := fmt.Sprintf("%s/recommend/popular", getAIURL())
	forwardRequestToAI(c, targetURL, func() {
		writeBookFallback(c, "", "Rekomendasi populer belum tersedia.")
	})
}

func forwardRequestToAI(c *gin.Context, targetURL string, fallback func()) {
	resp, err := http.Get(targetURL)
	if err != nil {
		fallback()
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fallback()
		return
	}

	if resp.StatusCode >= http.StatusInternalServerError {
		fallback()
		return
	}

	c.Data(resp.StatusCode, "application/json", body)
}

func refreshBookEmbedding(bookID uint) {
	payload, err := json.Marshal(map[string]uint{"book_id": bookID})
	if err != nil {
		return
	}

	request, err := http.NewRequest(http.MethodPost, getAIURL()+"/embeddings/books", bytes.NewReader(payload))
	if err != nil {
		return
	}
	request.Header.Set("Content-Type", "application/json")
	if internalToken := os.Getenv("AI_INTERNAL_TOKEN"); internalToken != "" {
		request.Header.Set("X-AI-Internal-Token", internalToken)
	}

	response, err := (&http.Client{}).Do(request)
	if err != nil {
		return
	}
	defer response.Body.Close()
}

func writeBookFallback(c *gin.Context, query string, warning string) {
	books, err := availableBooks(query, 8)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "AI Engine tidak tersedia dan fallback katalog gagal."})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"query":    query,
		"fallback": true,
		"warning":  warning,
		"results":  books,
	})
}
