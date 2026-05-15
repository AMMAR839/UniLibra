package controllers

import (
	"math"
	"net/http"
	"time"

	"unilibra-backend/internal/pkg/config"
	"unilibra-backend/internal/pkg/models"

	"github.com/gin-gonic/gin"
)

// BorrowBookInput adalah wadah untuk menerima data dari Frontend
type BorrowBookInput struct {
	BookID             uint      `json:"book_id" binding:"required"`
	BorrowDate         time.Time `json:"borrow_date" binding:"required"`
	ExpectedReturnDate time.Time `json:"expected_return_date" binding:"required"`
}

// RequestBorrow mengajukan permintaan peminjaman buku
func RequestBorrow(c *gin.Context) {
	var input BorrowBookInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format data tidak valid. Pastikan format tanggal menggunakan RFC3339 (Contoh: 2026-05-20T10:00:00Z)"})
		return
	}

	// 1. Ambil ID User yang sedang login (Peminjam)
	userID, _ := c.Get("userID")
	borrowerID := uint(userID.(float64))

	// 2. Cari buku yang ingin dipinjam
	var book models.Book
	if err := config.DB.First(&book, input.BookID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Buku tidak ditemukan"})
		return
	}

	// 3. VALIDASI KEAMANAN & BISNIS
	// a. Tidak boleh meminjam buku milik sendiri
	if book.OwnerID == borrowerID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Anda tidak bisa meminjam buku milik Anda sendiri"})
		return
	}

	// b. Buku harus dalam status "available"
	if book.Status != "available" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mohon maaf, buku ini sedang tidak tersedia atau sedang dipinjam orang lain"})
		return
	}

	// c. Tanggal kembali tidak boleh mundur (sebelum tanggal pinjam)
	if input.ExpectedReturnDate.Before(input.BorrowDate) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal pengembalian tidak valid"})
		return
	}

	// 4. Hitung Total Harga
	// Mengurangi waktu (Return - Borrow) untuk mendapatkan durasi dalam hitungan jam, lalu dibagi 24 menjadi hari
	durationHours := input.ExpectedReturnDate.Sub(input.BorrowDate).Hours()
	days := int(math.Ceil(durationHours / 24))

	// Jika pinjam kurang dari 24 jam, tetap dihitung 1 hari
	if days <= 0 {
		days = 1
	}
	totalPrice := int(float64(days) * book.RentalPrice)

	// 5. Buat dan simpan transaksi ke database
	transaction := models.Transaction{
		BookID:             book.ID,
		BorrowerID:         borrowerID,
		BorrowDate:         input.BorrowDate,
		ExpectedReturnDate: input.ExpectedReturnDate,
		Status:             "PENDING_APPROVAL",
		TotalPrice:         totalPrice,
	}

	if err := config.DB.Create(&transaction).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengajukan peminjaman"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Permintaan peminjaman berhasil dikirim ke pemilik buku",
		"data":    transaction,
	})
}

// UpdateTransactionStatusInput adalah wadah JSON dari Frontend
type UpdateTransactionStatusInput struct {
	Status string `json:"status" binding:"required"` // Harus diisi ACCEPTED atau REJECTED
}

// RespondToBorrowRequest mengeksekusi persetujuan atau penolakan oleh Pemilik Buku
func RespondToBorrowRequest(c *gin.Context) {
	transactionID := c.Param("id")
	var input UpdateTransactionStatusInput

	// 1. Tangkap JSON Body
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format data tidak valid"})
		return
	}

	// 2. Validasi input: hanya boleh ACCEPTED atau REJECTED
	if input.Status != "ACCEPTED" && input.Status != "REJECTED" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status hanya boleh ACCEPTED atau REJECTED"})
		return
	}

	// 3. Ambil ID User yang sedang login
	userID, _ := c.Get("userID")
	currentUserID := uint(userID.(float64))

	// 4. Cari data transaksi
	var transaction models.Transaction
	if err := config.DB.First(&transaction, transactionID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Transaksi tidak ditemukan"})
		return
	}

	// 5. Cari data buku untuk mengecek siapa pemilik aslinya
	var book models.Book
	if err := config.DB.First(&book, transaction.BookID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Buku tidak ditemukan"})
		return
	}

	// 6. VALIDASI KEAMANAN (Hanya pemilik buku yang boleh merespons)
	if book.OwnerID != currentUserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akses ditolak. Hanya pemilik buku yang dapat merespons permintaan ini."})
		return
	}

	if transaction.Status != "PENDING_APPROVAL" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Transaksi ini sudah diproses sebelumnya"})
		return
	}

	// 7. Simpan status transaksi yang baru
	transaction.Status = input.Status
	if err := config.DB.Save(&transaction).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan status transaksi"})
		return
	}

	// 8. Jika DITERIMA, ubah status buku menjadi "rented" agar tidak bisa dipinjam orang lain
	if input.Status == "ACCEPTED" {
		book.Status = "rented"
		config.DB.Save(&book)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Status transaksi berhasil diperbarui menjadi " + input.Status,
		"data":    transaction,
	})
}
