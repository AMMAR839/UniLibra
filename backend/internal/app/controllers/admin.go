package controllers

import (
	"net/http"
	"strings"
	"time"

	"unilibra-backend/internal/pkg/config"
	"unilibra-backend/internal/pkg/models"

	"github.com/gin-gonic/gin"
)

type adminUserPatch struct {
	Role   string `json:"role"`
	Status string `json:"status"`
}

type adminBookPatch struct {
	Status string `json:"status"`
}

func GetAdminSummary(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": adminSummary()})
}

func GetAdminUsers(c *gin.Context) {
	var users []models.User
	db := config.DB.Order("created_at DESC").Limit(120)
	if query := strings.TrimSpace(c.Query("q")); query != "" {
		like := "%" + strings.ToLower(query) + "%"
		db = db.Where("LOWER(name) LIKE ? OR LOWER(email) LIKE ?", like, like)
	}

	if err := db.Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil pengguna."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": users})
}

func PatchAdminUser(c *gin.Context) {
	var input adminUserPatch
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Perubahan user tidak valid."})
		return
	}

	updates := map[string]interface{}{}
	if input.Role != "" {
		if input.Role != "user" && input.Role != "admin" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Role user harus user atau admin."})
			return
		}
		updates["role"] = input.Role
	}
	if input.Status != "" {
		if input.Status != "active" && input.Status != "suspended" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Status user harus active atau suspended."})
			return
		}
		updates["status"] = input.Status
	}
	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak ada perubahan user."})
		return
	}

	var user models.User
	if err := config.DB.First(&user, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pengguna tidak ditemukan."})
		return
	}
	if err := config.DB.Model(&user).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui pengguna."})
		return
	}
	config.DB.First(&user, user.ID)

	c.JSON(http.StatusOK, gin.H{"data": user})
}

func GetAdminBooks(c *gin.Context) {
	var books []models.Book
	db := config.DB.Preload("Owner").Order("created_at DESC").Limit(120)
	if query := strings.TrimSpace(c.Query("q")); query != "" {
		like := "%" + strings.ToLower(query) + "%"
		db = db.Where("LOWER(title) LIKE ? OR LOWER(author) LIKE ?", like, like)
	}
	if err := db.Find(&books).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil listing buku."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": books})
}

func PatchAdminBook(c *gin.Context) {
	var input adminBookPatch
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Perubahan buku tidak valid."})
		return
	}

	if input.Status != "available" && input.Status != "rented" && input.Status != "hidden" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status buku tidak didukung."})
		return
	}

	var book models.Book
	if err := config.DB.First(&book, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Buku tidak ditemukan."})
		return
	}
	if err := config.DB.Model(&book).Update("status", input.Status).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui status buku."})
		return
	}
	config.DB.Preload("Owner").First(&book, book.ID)

	c.JSON(http.StatusOK, gin.H{"data": book})
}

func GetAdminTransactions(c *gin.Context) {
	var transactions []models.Transaction
	if err := config.DB.Preload("Book").Preload("Book.Owner").Preload("Borrower").
		Order("created_at DESC").
		Limit(160).
		Find(&transactions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil transaksi."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": transactions})
}

func GetAdminReports(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"summary":                adminSummary(),
		"generated_at":           time.Now(),
		"pending_transactions":   transactionCount("PENDING_APPROVAL"),
		"return_pending":         transactionCount("RETURN_PENDING"),
		"completed_transactions": transactionCount("COMPLETED"),
		"unread_notifications":   unreadNotificationCount(),
	}})
}

func adminSummary() gin.H {
	var users int64
	var books int64
	var activeBooks int64
	var activeTransactions int64
	var completedTransactions int64

	config.DB.Model(&models.User{}).Count(&users)
	config.DB.Model(&models.Book{}).Count(&books)
	config.DB.Model(&models.Book{}).Where("status = ?", "available").Count(&activeBooks)
	config.DB.Model(&models.Transaction{}).Where("status IN ?", []string{"PENDING_APPROVAL", "ACCEPTED", "RETURN_PENDING"}).Count(&activeTransactions)
	config.DB.Model(&models.Transaction{}).Where("status = ?", "COMPLETED").Count(&completedTransactions)

	return gin.H{
		"users":                  users,
		"books":                  books,
		"available_books":        activeBooks,
		"active_transactions":    activeTransactions,
		"completed_transactions": completedTransactions,
	}
}

func transactionCount(status string) int64 {
	var count int64
	config.DB.Model(&models.Transaction{}).Where("status = ?", status).Count(&count)
	return count
}

func unreadNotificationCount() int64 {
	var count int64
	config.DB.Model(&models.Notification{}).Where("read_at IS NULL").Count(&count)
	return count
}
