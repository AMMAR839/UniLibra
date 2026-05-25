package controllers

import (
	"math"
	"net/http"
	"strings"
	"time"

	"unilibra-backend/internal/pkg/config"
	"unilibra-backend/internal/pkg/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm/clause"
)

type BorrowBookInput struct {
	BookID             uint      `json:"book_id" binding:"required"`
	BorrowDate         time.Time `json:"borrow_date" binding:"required"`
	ExpectedReturnDate time.Time `json:"expected_return_date" binding:"required"`
	Handover           string    `json:"handover"`
	Location           string    `json:"location"`
	Note               string    `json:"note"`
}

func RequestBorrow(c *gin.Context) {
	var input BorrowBookInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format data tidak valid. Pastikan format tanggal menggunakan RFC3339 (Contoh: 2026-05-20T10:00:00Z)"})
		return
	}

	userID, _ := c.Get("userID")
	borrowerID := userID.(uint)

	var book models.Book
	if err := config.DB.First(&book, input.BookID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Buku tidak ditemukan"})
		return
	}

	if book.OwnerID == borrowerID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Anda tidak bisa meminjam buku milik Anda sendiri"})
		return
	}

	if book.Status != "available" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mohon maaf, buku ini sedang tidak tersedia atau sedang dipinjam orang lain"})
		return
	}

	if input.ExpectedReturnDate.Before(input.BorrowDate) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal pengembalian tidak valid"})
		return
	}

	durationHours := input.ExpectedReturnDate.Sub(input.BorrowDate).Hours()
	days := int(math.Ceil(durationHours / 24))

	if days <= 0 {
		days = 1
	}
	weeks := int(math.Ceil(float64(days) / 7))
	if weeks <= 0 {
		weeks = 1
	}
	totalPrice := float64(weeks) * book.RentalPrice

	transaction := models.Transaction{
		BookID:             book.ID,
		BorrowerID:         borrowerID,
		BorrowDate:         input.BorrowDate,
		ExpectedReturnDate: input.ExpectedReturnDate,
		Handover:           cleanTransactionText(input.Handover, 100),
		Location:           cleanTransactionText(input.Location, 160),
		Note:               cleanTransactionText(input.Note, 1200),
		Status:             "PENDING_APPROVAL",
		TotalPrice:         totalPrice,
	}

	if err := config.DB.Create(&transaction).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengajukan peminjaman"})
		return
	}

	createNotification(
		book.OwnerID,
		"transaction",
		"Permintaan peminjaman baru",
		"Ada pengguna yang ingin meminjam "+book.Title+".",
		"/profil",
	)

	c.JSON(http.StatusCreated, gin.H{
		"message": "Permintaan peminjaman berhasil dikirim ke pemilik buku",
		"data":    transaction,
	})
}

type UpdateTransactionStatusInput struct {
	Status string `json:"status" binding:"required"`
}

type RateTransactionInput struct {
	Rating  int    `json:"rating" binding:"required,min=1,max=5"`
	Comment string `json:"comment"`
}

func RespondToBorrowRequest(c *gin.Context) {
	transactionID := c.Param("id")
	var input UpdateTransactionStatusInput

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format data tidak valid"})
		return
	}

	if input.Status != "ACCEPTED" && input.Status != "REJECTED" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status hanya boleh ACCEPTED atau REJECTED"})
		return
	}

	userID, _ := c.Get("userID")
	currentUserID := userID.(uint)

	var transaction models.Transaction
	if err := config.DB.First(&transaction, transactionID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Transaksi tidak ditemukan"})
		return
	}

	var book models.Book
	if err := config.DB.First(&book, transaction.BookID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Buku tidak ditemukan"})
		return
	}

	if book.OwnerID != currentUserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akses ditolak. Hanya pemilik buku yang dapat merespons permintaan ini."})
		return
	}

	if transaction.Status != "PENDING_APPROVAL" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Transaksi ini sudah diproses sebelumnya"})
		return
	}

	transaction.Status = input.Status
	if err := config.DB.Save(&transaction).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan status transaksi"})
		return
	}

	if input.Status == "ACCEPTED" {
		book.Status = "rented"
		config.DB.Save(&book)
	}

	notificationTitle := "Permintaan peminjaman ditolak"
	if input.Status == "ACCEPTED" {
		notificationTitle = "Permintaan peminjaman diterima"
	}
	createNotification(
		transaction.BorrowerID,
		"transaction",
		notificationTitle,
		"Status peminjaman "+book.Title+" berubah menjadi "+input.Status+".",
		"/profil",
	)

	c.JSON(http.StatusOK, gin.H{
		"message": "Status transaksi berhasil diperbarui menjadi " + input.Status,
		"data":    transaction,
	})
}

func InitiateReturn(c *gin.Context) {
	transactionID := c.Param("id")

	userID, _ := c.Get("userID")
	currentUserID := userID.(uint)

	var transaction models.Transaction
	if err := config.DB.First(&transaction, transactionID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Transaksi tidak ditemukan"})
		return
	}

	if transaction.BorrowerID != currentUserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Hanya peminjam yang bisa melakukan pengembalian"})
		return
	}

	if transaction.Status != "ACCEPTED" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Buku ini belum dipinjam atau sudah dikembalikan"})
		return
	}

	transaction.Status = "RETURN_PENDING"
	if err := config.DB.Save(&transaction).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate status transaksi"})
		return
	}

	createNotification(
		bookOwnerID(transaction.BookID),
		"transaction",
		"Permintaan pengembalian baru",
		"Peminjam mengajukan pengembalian buku.",
		"/profil",
	)

	c.JSON(http.StatusOK, gin.H{
		"message": "Permintaan pengembalian dikirim ke pemilik buku",
		"data":    transaction,
	})
}

func ConfirmReturn(c *gin.Context) {
	transactionID := c.Param("id")

	userID, _ := c.Get("userID")
	currentUserID := userID.(uint)

	var transaction models.Transaction
	if err := config.DB.First(&transaction, transactionID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Transaksi tidak ditemukan"})
		return
	}

	var book models.Book
	if err := config.DB.First(&book, transaction.BookID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Buku tidak ditemukan"})
		return
	}

	if book.OwnerID != currentUserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Hanya pemilik buku yang bisa mengonfirmasi pengembalian"})
		return
	}

	if transaction.Status != "RETURN_PENDING" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pengembalian belum diajukan oleh peminjam"})
		return
	}

	transaction.Status = "COMPLETED"
	if err := config.DB.Save(&transaction).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyelesaikan transaksi"})
		return
	}

	book.Status = "available"
	if err := config.DB.Save(&book).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengubah status buku"})
		return
	}

	createNotification(
		transaction.BorrowerID,
		"transaction",
		"Pengembalian selesai",
		"Pemilik telah mengonfirmasi pengembalian "+book.Title+".",
		"/profil",
	)

	c.JSON(http.StatusOK, gin.H{
		"message": "Transaksi selesai! Buku kembali tersedia.",
		"data":    transaction,
	})
}

func RateCompletedTransaction(c *gin.Context) {
	transactionID := c.Param("id")
	var input RateTransactionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Rating harus bernilai 1 sampai 5."})
		return
	}

	userID, _ := c.Get("userID")
	currentUserID := userID.(uint)

	var transaction models.Transaction
	if err := config.DB.First(&transaction, transactionID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Transaksi tidak ditemukan"})
		return
	}

	if transaction.BorrowerID != currentUserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Hanya peminjam buku ini yang bisa memberi rating."})
		return
	}

	if transaction.Status != "COMPLETED" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Rating bisa diberikan setelah transaksi selesai."})
		return
	}

	rating := models.BookRating{
		BookID:        transaction.BookID,
		UserID:        currentUserID,
		TransactionID: transaction.ID,
		Rating:        input.Rating,
		Comment:       cleanTransactionText(input.Comment, 1000),
	}

	if err := config.DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "transaction_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"rating", "comment", "updated_at"}),
	}).Create(&rating).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan rating buku."})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Rating buku berhasil disimpan.",
		"data":    rating,
	})
}

func bookOwnerID(bookID uint) uint {
	var book models.Book
	if err := config.DB.Select("owner_id").First(&book, bookID).Error; err != nil {
		return 0
	}

	return book.OwnerID
}

func cleanTransactionText(value string, limit int) string {
	value = strings.TrimSpace(value)
	if len([]rune(value)) <= limit {
		return value
	}

	return string([]rune(value)[:limit])
}
