package controllers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"unilibra-backend/internal/pkg/config"
	"unilibra-backend/internal/pkg/models"

	"github.com/gin-gonic/gin"
)

type CreateChatThreadInput struct {
	ParticipantID uint  `json:"participant_id" binding:"required"`
	BookID        *uint `json:"book_id"`
}

type CreateChatMessageInput struct {
	Body string `json:"body" binding:"required"`
}

func GetChatThreads(c *gin.Context) {
	var threads []models.ChatThread
	if err := config.DB.
		Preload("Book").
		Preload("CreatedBy").
		Preload("Recipient").
		Where("created_by_id = ? OR recipient_id = ?", currentUserID(c), currentUserID(c)).
		Order("COALESCE(last_message_at, created_at) DESC").
		Find(&threads).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil percakapan."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": threads})
}

func CreateChatThread(c *gin.Context) {
	var input CreateChatThreadInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Penerima chat wajib dipilih."})
		return
	}

	userID := currentUserID(c)
	if input.ParticipantID == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Chat membutuhkan pengguna lain."})
		return
	}

	var participant models.User
	if err := config.DB.First(&participant, input.ParticipantID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pengguna tujuan tidak ditemukan."})
		return
	}

	query := config.DB.Where(
		"((created_by_id = ? AND recipient_id = ?) OR (created_by_id = ? AND recipient_id = ?))",
		userID,
		input.ParticipantID,
		input.ParticipantID,
		userID,
	)
	if input.BookID == nil {
		query = query.Where("book_id IS NULL")
	} else {
		query = query.Where("book_id = ?", *input.BookID)
	}

	var thread models.ChatThread
	if err := query.First(&thread).Error; err != nil {
		thread = models.ChatThread{
			BookID:      input.BookID,
			CreatedByID: userID,
			RecipientID: input.ParticipantID,
		}
		if err := config.DB.Create(&thread).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat percakapan."})
			return
		}
	}

	config.DB.Preload("Book").Preload("CreatedBy").Preload("Recipient").First(&thread, thread.ID)
	c.JSON(http.StatusCreated, gin.H{"data": thread})
}

func GetChatMessages(c *gin.Context) {
	thread, err := chatThreadForUser(currentUserID(c), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var messages []models.ChatMessage
	if err := config.DB.Preload("Sender").
		Where("thread_id = ?", thread.ID).
		Order("created_at ASC").
		Limit(160).
		Find(&messages).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil isi chat."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": messages})
}

func PostChatMessage(c *gin.Context) {
	var input CreateChatMessageInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pesan chat tidak boleh kosong."})
		return
	}

	message, recipientID, err := saveChatMessage(currentUserID(c), parseUintParam(c.Param("id")), input.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	realtime.broadcast(currentUserID(c), "chat.message", message)
	realtime.broadcast(recipientID, "chat.message", message)
	c.JSON(http.StatusCreated, gin.H{"data": message})
}

func saveChatMessage(senderID uint, threadID uint, body string) (models.ChatMessage, uint, error) {
	body = strings.TrimSpace(body)
	if body == "" {
		return models.ChatMessage{}, 0, fmt.Errorf("pesan chat tidak boleh kosong")
	}

	thread, err := chatThreadForUser(senderID, threadID)
	if err != nil {
		return models.ChatMessage{}, 0, err
	}

	message := models.ChatMessage{
		ThreadID: thread.ID,
		SenderID: senderID,
		Body:     body,
	}
	if err := config.DB.Create(&message).Error; err != nil {
		return models.ChatMessage{}, 0, fmt.Errorf("gagal menyimpan pesan chat")
	}

	now := time.Now()
	thread.LastMessageAt = &now
	_ = config.DB.Model(&thread).Update("last_message_at", &now).Error
	config.DB.Preload("Sender").First(&message, message.ID)

	recipientID := thread.RecipientID
	if senderID == thread.RecipientID {
		recipientID = thread.CreatedByID
	}

	createNotification(recipientID, "chat", "Pesan chat baru", previewMessage(message.Body), "/profil")
	return message, recipientID, nil
}

func chatThreadForUser(userID uint, identifier interface{}) (models.ChatThread, error) {
	var thread models.ChatThread
	if err := config.DB.Where("id = ? AND (created_by_id = ? OR recipient_id = ?)", identifier, userID, userID).
		First(&thread).Error; err != nil {
		return models.ChatThread{}, fmt.Errorf("percakapan tidak ditemukan")
	}

	return thread, nil
}

func previewMessage(body string) string {
	if len([]rune(body)) <= 120 {
		return body
	}

	return string([]rune(body)[:120]) + "..."
}

func parseUintParam(value string) uint {
	var parsed uint
	_, _ = fmt.Sscanf(value, "%d", &parsed)
	return parsed
}
