package controllers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"unilibra-backend/internal/pkg/config"
	"unilibra-backend/internal/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite" // <-- KITA MENGGUNAKAN PURE GO SQLITE SEKARANG
	"github.com/stretchr/testify/assert"
	"gorm.io/gorm"
)

// setupTestDB membuat database SQLite sementara di memori RAM khusus untuk testing
func setupTestDB() {
	// Membuka koneksi ke SQLite in-memory (Pure Go)
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		panic("Gagal membuka database test")
	}

	// Migrate tabel Buku
	db.AutoMigrate(&models.Book{})

	// Timpa variabel global DB di config dengan database test ini
	config.DB = db
}

func TestCreateBook_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupTestDB()

	r := gin.Default()

	r.POST("/api/books", func(c *gin.Context) {
		c.Set("userID", float64(1))
		CreateBook(c)
	})

	bookData := CreateBookInput{
		Title:       "Bumi Manusia",
		Author:      "Pramoedya Ananta Toer",
		Description: "Buku sejarah mulus.",
		RentalPrice: 5000,
		Latitude:    -7.7678,
		Longitude:   110.3789,
	}
	jsonValue, _ := json.Marshal(bookData)

	req, _ := http.NewRequest("POST", "/api/books", bytes.NewBuffer(jsonValue))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)
	assert.Contains(t, w.Body.String(), "Buku berhasil ditambahkan")
}

func TestCreateBook_ValidationError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupTestDB()

	r := gin.Default()
	r.POST("/api/books", func(c *gin.Context) {
		c.Set("userID", float64(1))
		CreateBook(c)
	})

	bookData := map[string]interface{}{
		"rental_price": 5000,
	}
	jsonValue, _ := json.Marshal(bookData)

	req, _ := http.NewRequest("POST", "/api/books", bytes.NewBuffer(jsonValue))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "Data buku tidak lengkap")
}

// --- TEST FITUR READ (GET) ---

func TestGetBooks(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupTestDB()

	// Masukkan 2 data dummy ke database
	config.DB.Create(&models.Book{Title: "Buku Tersedia", Status: "available"})
	config.DB.Create(&models.Book{Title: "Buku Dipinjam", Status: "rented"}) // Seharusnya tidak muncul

	r := gin.Default()
	r.GET("/api/books", GetBooks)

	req, _ := http.NewRequest("GET", "/api/books", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	// Pastikan hanya buku yang 'available' yang tertangkap
	assert.Contains(t, w.Body.String(), "Buku Tersedia")
	assert.NotContains(t, w.Body.String(), "Buku Dipinjam")
}

// --- TEST FITUR READ (GET) ---

func TestGetBookByID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupTestDB()

	book := models.Book{Title: "Harry Potter", Description: "Buku Sihir"}
	config.DB.Create(&book) // Database otomatis memberi ID ke variabel 'book' ini

	r := gin.Default()
	r.GET("/api/books/:id", GetBookByID)

	// KUNCI PERBAIKAN 1: Gunakan ID yang dinamis, jangan hardcode angka 1
	url := fmt.Sprintf("/api/books/%d", book.ID)
	req, _ := http.NewRequest("GET", url, nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "Harry Potter")
}

// --- TEST FITUR UPDATE (PUT) ---

func TestUpdateBook_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupTestDB()

	// Buat buku awal
	book := models.Book{Title: "Buku Lama", OwnerID: 1}
	config.DB.Create(&book)

	r := gin.Default()
	r.PUT("/api/books/:id", func(c *gin.Context) {
		c.Set("userID", float64(1)) // Simulasi login sebagai OwnerID 1
		UpdateBook(c)
	})

	// KUNCI PERBAIKAN 2: Isi SEMUA data yang diwajibkan oleh struktur CreateBookInput
	updateData := CreateBookInput{
		Title:       "Buku Baru",
		Author:      "Penulis Baru",
		Description: "Buku ini sudah diupdate",
		RentalPrice: 15000,
		Latitude:    -7.7678,
		Longitude:   110.3789,
	}
	jsonValue, _ := json.Marshal(updateData)

	url := fmt.Sprintf("/api/books/%d", book.ID)
	req, _ := http.NewRequest("PUT", url, bytes.NewBuffer(jsonValue))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "Buku Baru")
}

// --- TEST FITUR DELETE (DELETE) ---

func TestDeleteBook_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupTestDB()

	book := models.Book{Title: "Buku Untuk Dihapus", OwnerID: 1}
	config.DB.Create(&book)

	r := gin.Default()
	r.DELETE("/api/books/:id", func(c *gin.Context) {
		c.Set("userID", float64(1)) // Simulasi login sebagai OwnerID 1
		DeleteBook(c)
	})

	req, _ := http.NewRequest("DELETE", "/api/books/1", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "Buku berhasil ditarik dari katalog")

	// Verifikasi ke database langsung apakah benar-benar terhapus (Soft Delete)
	var deletedBook models.Book
	err := config.DB.First(&deletedBook, 1).Error
	assert.Error(t, err) // Harusnya menghasilkan error karena buku sudah tidak ada
}
