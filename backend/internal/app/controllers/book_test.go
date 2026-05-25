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
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"gorm.io/gorm"
)

func setupTestDB() {
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		panic("Gagal membuka database test")
	}

	db.Migrator().DropTable(&models.Book{}, &models.User{})
	db.AutoMigrate(&models.User{}, &models.Book{})

	config.DB = db
}

func TestCreateBook_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupTestDB()

	r := gin.Default()

	r.POST("/api/books", func(c *gin.Context) {
		c.Set("userID", uint(1))
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
		c.Set("userID", uint(1))
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

func TestGetBooks(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupTestDB()

	config.DB.Create(&models.Book{Title: "Buku Tersedia", Status: "available"})
	config.DB.Create(&models.Book{Title: "Buku Dipinjam", Status: "rented"})

	r := gin.Default()
	r.GET("/api/books", GetBooks)

	req, _ := http.NewRequest("GET", "/api/books", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "Buku Tersedia")
	assert.NotContains(t, w.Body.String(), "Buku Dipinjam")
}

func TestGetBooks_AggregatesSameTitle(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupTestDB()

	config.DB.Create(&models.Book{
		Title:       "BULAN  ",
		Author:      "Tere Liye",
		Category:    "Novel",
		Theme:       "Fantasi",
		RentalPrice: 2000,
		Status:      "available",
	})
	config.DB.Create(&models.Book{
		Title:       "Bulan",
		Author:      "Tere Liye",
		Category:    "Novel",
		Theme:       "Fantasi",
		RentalPrice: 9000,
		Status:      "available",
	})
	config.DB.Create(&models.Book{
		Title:       "Matahari",
		Author:      "Tere Liye",
		RentalPrice: 7000,
		Status:      "available",
	})

	r := gin.Default()
	r.GET("/api/books", GetBooks)

	req, _ := http.NewRequest("GET", "/api/books", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var response struct {
		Data []CatalogBook `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &response)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Len(t, response.Data, 2)
	for _, item := range response.Data {
		if item.Title == "Bulan" {
			assert.Equal(t, 2, item.AvailableCount)
			assert.Equal(t, float64(2000), item.MinPrice)
			assert.Equal(t, float64(9000), item.MaxPrice)
		}
	}
}

func TestGetBooks_AggregatesDistanceRange(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupTestDB()

	config.DB.Create(&models.Book{
		Title:       "Bulan",
		Author:      "Tere Liye",
		RentalPrice: 2000,
		Latitude:    -7.78,
		Longitude:   110.37,
		Status:      "available",
	})
	config.DB.Create(&models.Book{
		Title:       "Bulan",
		Author:      "Tere Liye",
		RentalPrice: 9000,
		Latitude:    -7.8,
		Longitude:   110.39,
		Status:      "available",
	})

	r := gin.Default()
	r.GET("/api/books", GetBooks)

	req, _ := http.NewRequest("GET", "/api/books?latitude=-7.77&longitude=110.38", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var response struct {
		Data []CatalogBook `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &response)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Len(t, response.Data, 1)
	assert.NotNil(t, response.Data[0].MinDistanceKM)
	assert.NotNil(t, response.Data[0].MaxDistanceKM)
	assert.LessOrEqual(t, *response.Data[0].MinDistanceKM, *response.Data[0].MaxDistanceKM)
}

func TestGetBookVersions_ReturnsAllOwnersForTitle(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupTestDB()

	config.DB.Create(&models.Book{Title: "Bulan", Author: "Tere Liye", RentalPrice: 9000, Status: "available", OwnerID: 1})
	config.DB.Create(&models.Book{Title: "Bulan", Author: "Tere Liye", RentalPrice: 2000, Status: "available", OwnerID: 2})
	config.DB.Create(&models.Book{Title: "Matahari", Author: "Tere Liye", RentalPrice: 7000, Status: "available", OwnerID: 3})

	r := gin.Default()
	r.GET("/api/books/versions", GetBookVersions)

	req, _ := http.NewRequest("GET", "/api/books/versions?title=Bulan", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var response struct {
		Data []models.Book `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &response)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Len(t, response.Data, 2)
	assert.Equal(t, float64(2000), response.Data[0].RentalPrice)
	assert.Equal(t, float64(9000), response.Data[1].RentalPrice)
}

func TestGetBookByID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupTestDB()

	book := models.Book{Title: "Harry Potter", Description: "Buku Sihir"}
	config.DB.Create(&book)

	r := gin.Default()
	r.GET("/api/books/:id", GetBookByID)

	url := fmt.Sprintf("/api/books/%d", book.ID)
	req, _ := http.NewRequest("GET", url, nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "Harry Potter")
}

func TestUpdateBook_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupTestDB()

	book := models.Book{Title: "Buku Lama", OwnerID: 1}
	config.DB.Create(&book)

	r := gin.Default()
	r.PUT("/api/books/:id", func(c *gin.Context) {
		c.Set("userID", uint(1))
		UpdateBook(c)
	})

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

func TestDeleteBook_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupTestDB()

	book := models.Book{Title: "Buku Untuk Dihapus", OwnerID: 1}
	config.DB.Create(&book)

	r := gin.Default()
	r.DELETE("/api/books/:id", func(c *gin.Context) {
		c.Set("userID", uint(1))
		DeleteBook(c)
	})

	req, _ := http.NewRequest("DELETE", "/api/books/1", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "Buku berhasil ditarik dari katalog")

	var deletedBook models.Book
	err := config.DB.First(&deletedBook, 1).Error
	assert.Error(t, err)
}
