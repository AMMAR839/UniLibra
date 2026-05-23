package controllers

import (
	"fmt"
	"math"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"

	"unilibra-backend/internal/pkg/config"
	"unilibra-backend/internal/pkg/models"
	"unilibra-backend/internal/pkg/storage"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm/clause"
)

type CreateBookInput struct {
	Title       string  `json:"title" binding:"required"`
	Author      string  `json:"author" binding:"required"`
	Description string  `json:"description"`
	Category    string  `json:"category"`
	Theme       string  `json:"theme"`
	Condition   string  `json:"condition"`
	Location    string  `json:"location"`
	MaxDuration string  `json:"max_duration"`
	Handover    string  `json:"handover"`
	RentalPrice float64 `json:"rental_price" binding:"required,min=0"`
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
}

type BookFilters struct {
	Query     string
	Category  string
	Theme     string
	MinPrice  *float64
	MaxPrice  *float64
	MinDistance *float64
	MaxDistance *float64
	Sort      string
	Latitude  *float64
	Longitude *float64
}

func CreateBook(c *gin.Context) {
	input, cover, err := bindBookInput(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data buku tidak lengkap: " + err.Error()})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Sesi tidak valid."})
		return
	}

	ownerID := uint(userID.(float64))

	book := models.Book{
		Title:       input.Title,
		Author:      input.Author,
		Description: input.Description,
		Category:    input.Category,
		Theme:       input.Theme,
		Condition:   input.Condition,
		Location:    input.Location,
		MaxDuration: input.MaxDuration,
		Handover:    input.Handover,
		RentalPrice: input.RentalPrice,
		Latitude:    input.Latitude,
		Longitude:   input.Longitude,
		OwnerID:     ownerID,
		Status:      "available",
	}

	if cover != nil {
		coverURL, err := storage.SaveCover(cover)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		book.CoverURL = coverURL
	}

	if err := config.DB.Create(&book).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan buku ke database: " + err.Error()})
		return
	}

	go refreshBookEmbedding(book.ID)

	c.JSON(http.StatusCreated, gin.H{
		"message": "Buku berhasil ditambahkan ke katalog!",
		"data":    book,
	})
}

func GetBooks(c *gin.Context) {
	books, err := availableBooks(bookFiltersFromQuery(c), 48)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data katalog buku."})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Berhasil mengambil katalog buku",
		"data":    books,
	})
}

func availableBooks(filters BookFilters, limit int) ([]models.Book, error) {
	var books []models.Book
	db := config.DB.Preload("Owner").Where("books.status = ?", "available")

	if normalizedQuery := strings.ToLower(strings.TrimSpace(filters.Query)); normalizedQuery != "" {
		like := "%" + normalizedQuery + "%"
		db = db.Where(
			"LOWER(books.title) LIKE ? OR LOWER(books.author) LIKE ? OR LOWER(books.description) LIKE ? OR LOWER(books.category) LIKE ? OR LOWER(books.theme) LIKE ?",
			like,
			like,
			like,
			like,
			like,
		)
	}

	if category := strings.ToLower(strings.TrimSpace(filters.Category)); category != "" {
		db = db.Where("LOWER(books.category) = ?", category)
	}

	if theme := strings.ToLower(strings.TrimSpace(filters.Theme)); theme != "" {
		db = db.Where("LOWER(books.theme) = ?", theme)
	}

	if filters.MinPrice != nil {
		db = db.Where("books.rental_price >= ?", *filters.MinPrice)
	}

	if filters.MaxPrice != nil {
		db = db.Where("books.rental_price <= ?", *filters.MaxPrice)
	}

	if filters.Latitude != nil && filters.Longitude != nil {
		if filters.MinDistance != nil {
			db = db.Where(
				"books.latitude != 0 AND books.longitude != 0 AND (6371 * 2 * ASIN(SQRT(POWER(SIN(RADIANS(books.latitude - ?) / 2), 2) + COS(RADIANS(?)) * COS(RADIANS(books.latitude)) * POWER(SIN(RADIANS(books.longitude - ?) / 2), 2)))) >= ?",
				*filters.Latitude,
				*filters.Latitude,
				*filters.Longitude,
				*filters.MinDistance,
			)
		}
		if filters.MaxDistance != nil {
			db = db.Where(
				"books.latitude != 0 AND books.longitude != 0 AND (6371 * 2 * ASIN(SQRT(POWER(SIN(RADIANS(books.latitude - ?) / 2), 2) + COS(RADIANS(?)) * COS(RADIANS(books.latitude)) * POWER(SIN(RADIANS(books.longitude - ?) / 2), 2)))) <= ?",
				*filters.Latitude,
				*filters.Latitude,
				*filters.Longitude,
				*filters.MaxDistance,
			)
		}
	}

	if limit > 0 {
		db = db.Limit(limit)
	}

	switch filters.Sort {
	case "nearest":
		if filters.Latitude != nil && filters.Longitude != nil {
			db = db.Clauses(clause.OrderBy{
				Expression: clause.Expr{
					SQL: "CASE WHEN books.latitude = 0 OR books.longitude = 0 THEN 1 ELSE 0 END, (6371 * 2 * ASIN(SQRT(POWER(SIN(RADIANS(books.latitude - ?) / 2), 2) + COS(RADIANS(?)) * COS(RADIANS(books.latitude)) * POWER(SIN(RADIANS(books.longitude - ?) / 2), 2)))) ASC",
					Vars: []any{
						*filters.Latitude,
						*filters.Latitude,
						*filters.Longitude,
					},
					WithoutParentheses: true,
				},
			})
		}
	case "price_asc":
		db = db.Order("books.rental_price ASC")
	case "price_desc":
		db = db.Order("books.rental_price DESC")
	}

	return books, db.Order("books.updated_at DESC").Find(&books).Error
}

func GetBookByID(c *gin.Context) {
	bookID := c.Param("id")
	var book models.Book

	if err := config.DB.Preload("Owner").First(&book, bookID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Buku tidak ditemukan di katalog."})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Berhasil mengambil detail buku",
		"data":    book,
	})
}

func UpdateBook(c *gin.Context) {
	bookID := c.Param("id")
	var book models.Book

	if err := config.DB.First(&book, bookID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Buku tidak ditemukan"})
		return
	}

	userID, _ := c.Get("userID")
	if book.OwnerID != uint(userID.(float64)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akses ditolak: Anda bukan pemilik buku ini"})
		return
	}

	input, cover, err := bindBookInput(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format data tidak valid"})
		return
	}

	updates := map[string]any{
		"title":        input.Title,
		"author":       input.Author,
		"description":  input.Description,
		"category":     input.Category,
		"theme":        input.Theme,
		"condition":    input.Condition,
		"location":     input.Location,
		"max_duration": input.MaxDuration,
		"handover":     input.Handover,
		"rental_price": input.RentalPrice,
		"latitude":     input.Latitude,
		"longitude":    input.Longitude,
	}

	if cover != nil {
		coverURL, err := storage.SaveCover(cover)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		updates["cover_url"] = coverURL
	}

	if err := config.DB.Model(&book).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui buku"})
		return
	}
	config.DB.Preload("Owner").First(&book, book.ID)

	go refreshBookEmbedding(book.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Buku berhasil diperbarui",
		"data":    book,
	})
}

func DeleteBook(c *gin.Context) {
	bookID := c.Param("id")
	var book models.Book

	if err := config.DB.First(&book, bookID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Buku tidak ditemukan"})
		return
	}

	userID, _ := c.Get("userID")
	if book.OwnerID != uint(userID.(float64)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akses ditolak: Anda bukan pemilik buku ini"})
		return
	}

	config.DB.Delete(&book)

	c.JSON(http.StatusOK, gin.H{"message": "Buku berhasil ditarik dari katalog"})
}

func bindBookInput(c *gin.Context) (CreateBookInput, *multipart.FileHeader, error) {
	if strings.HasPrefix(c.ContentType(), "multipart/form-data") {
		rentalPrice, err := strconv.ParseFloat(strings.TrimSpace(c.PostForm("rental_price")), 64)
		if err != nil || rentalPrice < 0 {
			return CreateBookInput{}, nil, fmt.Errorf("harga pinjam tidak valid")
		}

		input := CreateBookInput{
			Title:       strings.TrimSpace(c.PostForm("title")),
			Author:      strings.TrimSpace(c.PostForm("author")),
			Description: strings.TrimSpace(c.PostForm("description")),
			Category:    strings.TrimSpace(c.PostForm("category")),
			Theme:       strings.TrimSpace(c.PostForm("theme")),
			Condition:   strings.TrimSpace(c.PostForm("condition")),
			Location:    strings.TrimSpace(c.PostForm("location")),
			MaxDuration: strings.TrimSpace(c.PostForm("max_duration")),
			Handover:    strings.TrimSpace(c.PostForm("handover")),
			RentalPrice: rentalPrice,
		}

		if input.Title == "" || input.Author == "" {
			return CreateBookInput{}, nil, fmt.Errorf("judul dan penulis wajib diisi")
		}

		if latitude, err := strconv.ParseFloat(strings.TrimSpace(c.PostForm("latitude")), 64); err == nil {
			input.Latitude = latitude
		}
		if longitude, err := strconv.ParseFloat(strings.TrimSpace(c.PostForm("longitude")), 64); err == nil {
			input.Longitude = longitude
		}

		cover, err := c.FormFile("cover")
		if err != nil && err != http.ErrMissingFile {
			return CreateBookInput{}, nil, err
		}

		return input, cover, nil
	}

	var input CreateBookInput
	if err := c.ShouldBindJSON(&input); err != nil {
		return CreateBookInput{}, nil, err
	}

	return input, nil, nil
}

func bookFiltersFromQuery(c *gin.Context) BookFilters {
	filters := BookFilters{
		Query:    c.Query("q"),
		Category: c.Query("category"),
		Theme:    c.Query("theme"),
		Sort:     c.Query("sort"),
	}

	if minPrice, ok := parseOptionalFloat(c.Query("min_price")); ok {
		filters.MinPrice = &minPrice
	}
	if maxPrice, ok := parseOptionalFloat(c.Query("max_price")); ok {
		filters.MaxPrice = &maxPrice
	}
	if minDistance, ok := parseOptionalFloat(c.Query("min_distance")); ok {
		filters.MinDistance = &minDistance
	}
	if maxDistance, ok := parseOptionalFloat(c.Query("max_distance")); ok {
		filters.MaxDistance = &maxDistance
	}
	if latitude, ok := parseOptionalFloat(c.Query("latitude")); ok {
		latitude = math.Max(math.Min(latitude, 90), -90)
		filters.Latitude = &latitude
	}
	if longitude, ok := parseOptionalFloat(c.Query("longitude")); ok {
		longitude = math.Max(math.Min(longitude, 180), -180)
		filters.Longitude = &longitude
	}

	return filters
}

func parseOptionalFloat(value string) (float64, bool) {
	trimmedValue := strings.TrimSpace(value)
	if trimmedValue == "" {
		return 0, false
	}

	parsedValue, err := strconv.ParseFloat(trimmedValue, 64)
	return parsedValue, err == nil
}
