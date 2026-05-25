package controllers

import (
	"net/http"
	"strings"
	"time"

	"unilibra-backend/internal/pkg/config"
	"unilibra-backend/internal/pkg/models"

	"github.com/gin-gonic/gin"
)

func GetNotifications(c *gin.Context) {
	userID := currentUserID(c)
	var notifications []models.Notification
	if err := config.DB.Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(80).
		Find(&notifications).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil notifikasi."})
		return
	}

	var unreadCount int64
	config.DB.Model(&models.Notification{}).
		Where("user_id = ? AND read_at IS NULL", userID).
		Count(&unreadCount)

	c.JSON(http.StatusOK, gin.H{
		"data":         notifications,
		"unread_count": unreadCount,
	})
}

func ReadNotification(c *gin.Context) {
	var notification models.Notification
	if err := config.DB.Where("id = ? AND user_id = ?", c.Param("id"), currentUserID(c)).
		First(&notification).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Notifikasi tidak ditemukan."})
		return
	}

	now := time.Now()
	notification.ReadAt = &now
	if err := config.DB.Save(&notification).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menandai notifikasi."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": notification})
}

func ReadAllNotifications(c *gin.Context) {
	now := time.Now()
	query := config.DB.Model(&models.Notification{}).
		Where("user_id = ? AND read_at IS NULL", currentUserID(c))

	if notificationType := strings.TrimSpace(c.Query("type")); notificationType != "" {
		query = query.Where("type = ?", notificationType)
	}

	if err := query.Update("read_at", &now).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menandai semua notifikasi."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Semua notifikasi sudah dibaca."})
}

func createNotification(userID uint, notificationType string, title string, body string, link string) {
	if userID == 0 {
		return
	}

	notification := models.Notification{
		UserID: userID,
		Type:   notificationType,
		Title:  title,
		Body:   body,
		Link:   link,
	}
	if err := config.DB.Create(&notification).Error; err != nil {
		return
	}

	realtime.broadcast(userID, "notification.created", notification)
}

func currentUserID(c *gin.Context) uint {
	userID, _ := c.Get("userID")
	return userID.(uint)
}
