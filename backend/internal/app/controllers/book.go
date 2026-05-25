package controllers

import (
	"fmt"
	"math"
	"mime/multipart"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"

	"unilibra-backend/internal/pkg/config"
	"unilibra-backend/internal/pkg/models"
	"unilibra-backend/internal/pkg/storage"
	"unilibra-backend/internal/pkg/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
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
	Query       string
	Category    string
	Theme       string
	MinPrice    *float64
	MaxPrice    *float64
	MinDistance *float64
	MaxDistance *float64
	MinChoices  int
	LocatedOnly bool
	Sort        string
	Latitude    *float64
	Longitude   *float64
	PersonalUserID *uint
}

type CatalogBook struct {
	ID            uint       `json:"id"`
	Title         string     `json:"title"`
	Author        string     `json:"author"`
	Category      string     `json:"category"`
	Theme         string     `json:"theme"`
	CoverURL      string     `json:"cover_url"`
	AvailableCount int       `json:"available_count"`
	MinPrice       float64   `json:"min_price"`
	MaxPrice       float64   `json:"max_price"`
	MinDistanceKM  *float64  `json:"min_distance_km,omitempty"`
	MaxDistanceKM  *float64  `json:"max_distance_km,omitempty"`
	PersonalScore  float64   `json:"personal_score,omitempty"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type catalogPersonalProfile struct {
	Categories map[string]float64
	Themes     map[string]float64
	Authors    map[string]float64
	Titles     map[string]float64
	Ready      bool
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
	books, personalized, err := catalogBooks(bookFiltersFromQuery(c), 72)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data katalog buku."})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Berhasil mengambil katalog buku",
		"data":         books,
		"personalized": personalized,
	})
}

func GetBookVersions(c *gin.Context) {
	title := normalizeBookTitleKey(c.Query("title"))
	author := strings.ToLower(strings.TrimSpace(c.Query("author")))
	if title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Judul buku wajib diisi."})
		return
	}

	var books []models.Book
	var available []models.Book
	if err := config.DB.Preload("Owner").Where("books.status = ?", "available").Find(&available).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil versi buku."})
		return
	}

	for _, book := range available {
		if normalizeBookTitleKey(book.Title) != title {
			continue
		}
		if author != "" && strings.ToLower(strings.TrimSpace(book.Author)) != author {
			continue
		}
		books = append(books, book)
	}
	attachBookRatings(books)
	sort.SliceStable(books, func(i, j int) bool {
		if books[i].RentalPrice == books[j].RentalPrice {
			return books[i].UpdatedAt.After(books[j].UpdatedAt)
		}
		return books[i].RentalPrice < books[j].RentalPrice
	})

	c.JSON(http.StatusOK, gin.H{
		"message": "Berhasil mengambil versi buku",
		"data":    books,
	})
}

func availableBooks(filters BookFilters, limit int) ([]models.Book, error) {
	var books []models.Book
	db := baseAvailableBooksQuery(filters).Preload("Owner")

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

	query := normalizeBookTitleKey(filters.Query)
	queryLimit := limit
	if query != "" && limit > 0 {
		queryLimit = max(limit*4, 80)
	}

	if queryLimit > 0 {
		db = db.Limit(queryLimit)
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

	if err := db.Order("books.updated_at DESC").Find(&books).Error; err != nil {
		return nil, err
	}
	if query != "" {
		sort.SliceStable(books, func(i, j int) bool {
			leftScore := bookSearchScore(books[i], query)
			rightScore := bookSearchScore(books[j], query)
			if leftScore != rightScore {
				return leftScore > rightScore
			}
			return books[i].UpdatedAt.After(books[j].UpdatedAt)
		})
		if limit > 0 && len(books) > limit {
			books = books[:limit]
		}
	}

	return books, nil
}

func catalogBooks(filters BookFilters, limit int) ([]CatalogBook, bool, error) {
	var books []models.Book
	if err := baseAvailableBooksQuery(filters).Order("books.updated_at DESC").Find(&books).Error; err != nil {
		return nil, false, err
	}

	personalProfile := loadCatalogPersonalProfile(filters.PersonalUserID)
	groups := make(map[string]*CatalogBook)
	for _, book := range books {
		distance := distanceFromFilter(filters, book)
		if filters.Latitude != nil && filters.Longitude != nil {
			if filters.LocatedOnly && distance == nil {
				continue
			}
			if filters.MinDistance != nil && (distance == nil || *distance < *filters.MinDistance) {
				continue
			}
			if filters.MaxDistance != nil && (distance == nil || *distance > *filters.MaxDistance) {
				continue
			}
		}

		key := normalizeBookTitleKey(book.Title)
		if key == "" {
			key = fmt.Sprintf("book-%d", book.ID)
		}

		current, exists := groups[key]
		if !exists {
			groups[key] = &CatalogBook{
				ID:             book.ID,
				Title:          book.Title,
				Author:         book.Author,
				Category:       book.Category,
				Theme:          book.Theme,
				CoverURL:       book.CoverURL,
				AvailableCount: 1,
				MinPrice:       book.RentalPrice,
				MaxPrice:       book.RentalPrice,
				UpdatedAt:      book.UpdatedAt,
			}
			current = groups[key]
		} else {
			current.AvailableCount++
			if book.RentalPrice < current.MinPrice {
				current.MinPrice = book.RentalPrice
			}
			if book.RentalPrice > current.MaxPrice {
				current.MaxPrice = book.RentalPrice
			}
			if book.UpdatedAt.After(current.UpdatedAt) {
				current.UpdatedAt = book.UpdatedAt
				current.ID = book.ID
				current.Author = book.Author
				current.Category = book.Category
				current.Theme = book.Theme
				if book.CoverURL != "" {
					current.CoverURL = book.CoverURL
				}
			} else if current.CoverURL == "" && book.CoverURL != "" {
				current.CoverURL = book.CoverURL
			}
		}

		if distance != nil {
			if current.MinDistanceKM == nil || *distance < *current.MinDistanceKM {
				value := *distance
				current.MinDistanceKM = &value
			}
			if current.MaxDistanceKM == nil || *distance > *current.MaxDistanceKM {
				value := *distance
				current.MaxDistanceKM = &value
			}
		}

		if personalProfile.Ready {
			score := catalogPersonalScore(book, personalProfile)
			if score > current.PersonalScore {
				current.PersonalScore = score
			}
		}
	}

	catalog := make([]CatalogBook, 0, len(groups))
	for _, item := range groups {
		if filters.MinChoices > 0 && item.AvailableCount < filters.MinChoices {
			continue
		}
		catalog = append(catalog, *item)
	}

	sortCatalogBooks(catalog, filters.Sort, filters.Query, personalProfile.Ready)
	if limit > 0 && len(catalog) > limit {
		catalog = catalog[:limit]
	}

	return catalog, personalProfile.Ready, nil
}

func baseAvailableBooksQuery(filters BookFilters) *gorm.DB {
	db := config.DB.Where("books.status = ?", "available")

	if normalizedQuery := strings.ToLower(strings.TrimSpace(filters.Query)); normalizedQuery != "" {
		like := "%" + normalizedQuery + "%"
		db = db.Where(
			`LOWER(books.title) LIKE ?
			 OR LOWER(books.author) LIKE ?
			 OR LOWER(books.description) LIKE ?
			 OR LOWER(books.category) LIKE ?
			 OR LOWER(books.theme) LIKE ?
			 OR LOWER(books.location) LIKE ?
			 OR similarity(LOWER(books.title), ?) > 0.18
			 OR similarity(LOWER(books.author), ?) > 0.2
			 OR word_similarity(?, LOWER(books.title)) > 0.28
			 OR word_similarity(?, LOWER(books.author)) > 0.28
			 OR word_similarity(?, LOWER(COALESCE(books.category, '') || ' ' || COALESCE(books.theme, '') || ' ' || COALESCE(books.description, ''))) > 0.24`,
			like,
			like,
			like,
			like,
			like,
			like,
			normalizedQuery,
			normalizedQuery,
			normalizedQuery,
			normalizedQuery,
			normalizedQuery,
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

	return db
}

func sortCatalogBooks(books []CatalogBook, sortMode string, query string, personalized bool) {
	normalizedQuery := normalizeBookTitleKey(query)
	sort.SliceStable(books, func(i, j int) bool {
		switch sortMode {
		case "nearest":
			left := books[i].MinDistanceKM
			right := books[j].MinDistanceKM
			if left == nil {
				return false
			}
			if right == nil {
				return true
			}
			return *left < *right
		case "price_asc", "best_price":
			return books[i].MinPrice < books[j].MinPrice
		case "price_desc":
			return books[i].MaxPrice > books[j].MaxPrice
		default:
			if normalizedQuery != "" {
				leftScore := catalogSearchScore(books[i], normalizedQuery)
				rightScore := catalogSearchScore(books[j], normalizedQuery)
				if leftScore != rightScore {
					return leftScore > rightScore
				}
			}
			if personalized && books[i].PersonalScore != books[j].PersonalScore {
				return books[i].PersonalScore > books[j].PersonalScore
			}
			return books[i].UpdatedAt.After(books[j].UpdatedAt)
		}
	})
}

func loadCatalogPersonalProfile(userID *uint) catalogPersonalProfile {
	profile := catalogPersonalProfile{
		Categories: make(map[string]float64),
		Themes:     make(map[string]float64),
		Authors:    make(map[string]float64),
		Titles:     make(map[string]float64),
	}
	if userID == nil {
		return profile
	}

	var transactions []models.Transaction
	if err := config.DB.Preload("Book").
		Where("borrower_id = ? AND status <> ?", *userID, "REJECTED").
		Order("created_at DESC").
		Limit(80).
		Find(&transactions).Error; err != nil {
		return profile
	}

	for index, transaction := range transactions {
		book := transaction.Book
		if book.ID == 0 {
			continue
		}
		weight := 1.0
		if transaction.Status == "COMPLETED" {
			weight += 0.45
		}
		if index < 10 {
			weight += 0.35
		}

		addPreferenceWeight(profile.Categories, book.Category, weight*1.15)
		addPreferenceWeight(profile.Themes, book.Theme, weight)
		addPreferenceWeight(profile.Authors, book.Author, weight*0.55)
		addPreferenceWeight(profile.Titles, book.Title, weight*0.35)
	}

	profile.Ready = len(profile.Categories)+len(profile.Themes)+len(profile.Authors)+len(profile.Titles) > 0
	return profile
}

func addPreferenceWeight(target map[string]float64, value string, weight float64) {
	key := normalizeBookTitleKey(value)
	if key == "" {
		return
	}
	target[key] += weight
}

func catalogPersonalScore(book models.Book, profile catalogPersonalProfile) float64 {
	score := 0.0
	score += profile.Categories[normalizeBookTitleKey(book.Category)] * 1.25
	score += profile.Themes[normalizeBookTitleKey(book.Theme)] * 1.05
	score += profile.Authors[normalizeBookTitleKey(book.Author)] * 0.75
	score += profile.Titles[normalizeBookTitleKey(book.Title)] * 0.45
	return score
}

func catalogSearchScore(book CatalogBook, normalizedQuery string) float64 {
	title := normalizeBookTitleKey(book.Title)
	author := normalizeBookTitleKey(book.Author)
	category := normalizeBookTitleKey(book.Category)
	theme := normalizeBookTitleKey(book.Theme)

	score := 0.0
	score = math.Max(score, textMatchScore(title, normalizedQuery)*1.25)
	score = math.Max(score, textMatchScore(author, normalizedQuery)*1.05)
	score = math.Max(score, textMatchScore(category, normalizedQuery)*0.82)
	score = math.Max(score, textMatchScore(theme, normalizedQuery)*0.82)
	return score
}

func bookSearchScore(book models.Book, normalizedQuery string) float64 {
	title := normalizeBookTitleKey(book.Title)
	author := normalizeBookTitleKey(book.Author)
	category := normalizeBookTitleKey(book.Category)
	theme := normalizeBookTitleKey(book.Theme)

	score := 0.0
	score = math.Max(score, textMatchScore(title, normalizedQuery)*1.5)
	score = math.Max(score, textMatchScore(author, normalizedQuery)*1.05)
	score = math.Max(score, textMatchScore(category, normalizedQuery)*0.82)
	score = math.Max(score, textMatchScore(theme, normalizedQuery)*0.82)
	return score
}

func textMatchScore(value string, query string) float64 {
	if value == "" || query == "" {
		return 0
	}
	if value == query {
		return 1
	}
	if strings.Contains(value, query) || strings.Contains(query, value) {
		return 0.92
	}

	best := normalizedEditSimilarity(value, query)
	for _, word := range strings.Fields(value) {
		best = math.Max(best, normalizedEditSimilarity(word, query))
	}
	return best
}

func normalizedEditSimilarity(left string, right string) float64 {
	leftRunes := []rune(left)
	rightRunes := []rune(right)
	if len(leftRunes) == 0 || len(rightRunes) == 0 {
		return 0
	}

	distance := levenshteinDistance(leftRunes, rightRunes)
	maxLen := math.Max(float64(len(leftRunes)), float64(len(rightRunes)))
	return 1 - float64(distance)/maxLen
}

func levenshteinDistance(left []rune, right []rune) int {
	previous := make([]int, len(right)+1)
	current := make([]int, len(right)+1)
	for j := range previous {
		previous[j] = j
	}

	for i := 1; i <= len(left); i++ {
		current[0] = i
		for j := 1; j <= len(right); j++ {
			cost := 0
			if left[i-1] != right[j-1] {
				cost = 1
			}
			current[j] = minInt(
				current[j-1]+1,
				previous[j]+1,
				previous[j-1]+cost,
			)
		}
		previous, current = current, previous
	}

	return previous[len(right)]
}

func minInt(values ...int) int {
	minimum := values[0]
	for _, value := range values[1:] {
		if value < minimum {
			minimum = value
		}
	}
	return minimum
}

func distanceFromFilter(filters BookFilters, book models.Book) *float64 {
	if filters.Latitude == nil || filters.Longitude == nil {
		return nil
	}
	if book.Latitude == 0 || book.Longitude == 0 {
		distance := fallbackDistanceKM(book)
		return &distance
	}

	distance := haversineKM(*filters.Latitude, *filters.Longitude, book.Latitude, book.Longitude)
	return &distance
}

func fallbackDistanceKM(book models.Book) float64 {
	seed := int(book.ID)
	if seed == 0 {
		for _, char := range normalizeBookTitleKey(book.Title) {
			seed += int(char)
		}
	}

	return 1.5 + float64(seed%80)/10
}

func haversineKM(lat1, lon1, lat2, lon2 float64) float64 {
	const earthRadiusKM = 6371
	latDelta := degreesToRadians(lat2 - lat1)
	lonDelta := degreesToRadians(lon2 - lon1)
	firstLat := degreesToRadians(lat1)
	secondLat := degreesToRadians(lat2)

	a := math.Sin(latDelta/2)*math.Sin(latDelta/2) +
		math.Cos(firstLat)*math.Cos(secondLat)*math.Sin(lonDelta/2)*math.Sin(lonDelta/2)
	return earthRadiusKM * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}

func degreesToRadians(value float64) float64 {
	return value * math.Pi / 180
}

type bookRatingStat struct {
	BookID        uint
	AverageRating float64
	RatingCount   int64
}

func attachBookRatings(books []models.Book) {
	if len(books) == 0 {
		return
	}

	bookIDs := make([]uint, 0, len(books))
	for _, book := range books {
		bookIDs = append(bookIDs, book.ID)
	}

	var stats []bookRatingStat
	if err := config.DB.Model(&models.BookRating{}).
		Select("book_id, AVG(rating) AS average_rating, COUNT(*) AS rating_count").
		Where("book_id IN ?", bookIDs).
		Group("book_id").
		Scan(&stats).Error; err != nil {
		return
	}

	statsByBookID := make(map[uint]bookRatingStat, len(stats))
	for _, stat := range stats {
		statsByBookID[stat.BookID] = stat
	}

	for index := range books {
		if stat, exists := statsByBookID[books[index].ID]; exists {
			books[index].AverageRating = stat.AverageRating
			books[index].RatingCount = stat.RatingCount
		}
	}
}

func normalizeBookTitleKey(title string) string {
	normalized := strings.Map(func(r rune) rune {
		if unicode.IsLetter(r) || unicode.IsNumber(r) {
			return unicode.ToLower(r)
		}
		return ' '
	}, strings.TrimSpace(title))

	return strings.Join(strings.Fields(normalized), " ")
}

func GetBookByID(c *gin.Context) {
	bookID := c.Param("id")
	var book models.Book

	if err := config.DB.Preload("Owner").First(&book, bookID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Buku tidak ditemukan di katalog."})
		return
	}
	ratedBooks := []models.Book{book}
	attachBookRatings(ratedBooks)
	book = ratedBooks[0]

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
		Query:          c.Query("q"),
		Category:       c.Query("category"),
		Theme:          c.Query("theme"),
		Sort:           c.Query("sort"),
		PersonalUserID: optionalUserIDFromRequest(c),
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
	if minChoices, err := strconv.Atoi(strings.TrimSpace(c.Query("min_choices"))); err == nil && minChoices > 0 {
		filters.MinChoices = minChoices
	}
	filters.LocatedOnly = strings.EqualFold(strings.TrimSpace(c.Query("located_only")), "true")
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

func optionalUserIDFromRequest(c *gin.Context) *uint {
	authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
	if authHeader == "" {
		return nil
	}

	tokenString := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
	if tokenString == "" || tokenString == authHeader {
		return nil
	}

	userID, err := utils.ParseToken(tokenString)
	if err != nil || userID == 0 {
		return nil
	}

	return &userID
}

func parseOptionalFloat(value string) (float64, bool) {
	trimmedValue := strings.TrimSpace(value)
	if trimmedValue == "" {
		return 0, false
	}

	parsedValue, err := strconv.ParseFloat(trimmedValue, 64)
	return parsedValue, err == nil
}
