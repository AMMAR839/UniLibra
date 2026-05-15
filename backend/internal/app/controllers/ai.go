package controllers

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"

	"github.com/gin-gonic/gin"
)

// getAIURL mengambil alamat internal container AI dari environment
func getAIURL() string {
	url := os.Getenv("AI_ENGINE_URL")
	if url == "" {
		// "ai-engine" adalah nama service AI di docker-compose.yml kita
		return "http://ai-engine:8000" 
	}
	return url
}

// SearchBooksAI meneruskan pencarian ke Semantic Search AI Nicholas
func SearchBooksAI(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter pencarian 'q' wajib diisi"})
		return
	}

	// Hindari error jika ada spasi di kalimat pencarian (misal: "Buku sihir")
	encodedQuery := url.QueryEscape(query)
	
	// Format URL: http://ai-engine:8000/search?query=Buku%20sihir
	targetURL := fmt.Sprintf("%s/search?query=%s", getAIURL(), encodedQuery)
	
	forwardRequestToAI(c, targetURL)
}

// GetSimilarBooks meneruskan request rekomendasi buku yang mirip
func GetSimilarBooks(c *gin.Context) {
	bookID := c.Param("id")
	targetURL := fmt.Sprintf("%s/recommend/similar/%s", getAIURL(), bookID)
	forwardRequestToAI(c, targetURL)
}

// GetPopularBooks meneruskan request buku terpopuler
func GetPopularBooks(c *gin.Context) {
	targetURL := fmt.Sprintf("%s/recommend/popular", getAIURL())
	forwardRequestToAI(c, targetURL)
}

// --- FUNGSI BANTUAN (HELPER) ---
// forwardRequestToAI adalah fungsi "Makelar" yang mengeksekusi HTTP Request internal ke Python
func forwardRequestToAI(c *gin.Context, targetURL string) {
	// 1. Golang menelepon Python
	resp, err := http.Get(targetURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal terhubung ke AI Engine"})
		return
	}
	defer resp.Body.Close() // Pastikan jalur telepon ditutup agar tidak bocor memori

	// 2. Golang membaca jawaban dari Python
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca balasan dari AI Engine"})
		return
	}

	// 3. Golang langsung mengoper JSON mentah dari Python ke Frontend Ammar
	c.Data(resp.StatusCode, "application/json", body)
}
