package models

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	Name         string         `gorm:"type:varchar(100);not null" json:"name"`
	Email        string         `gorm:"type:varchar(100);uniqueIndex;not null" json:"email"`
	PasswordHash string         `json:"-"`
	GoogleID     *string        `gorm:"type:varchar(120);uniqueIndex" json:"-"`
	Role         string         `gorm:"type:varchar(20);default:'user'" json:"role"`
	Status       string         `gorm:"type:varchar(20);default:'active'" json:"status"`
	City         string         `gorm:"type:varchar(100)" json:"city"`
	PhoneNumber  string         `gorm:"type:varchar(20)" json:"phone_number"`
	Latitude     float64        `json:"latitude"`
	Longitude    float64        `json:"longitude"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

type Book struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Title       string    `gorm:"not null" json:"title"`
	Author      string    `gorm:"not null" json:"author"`
	Description string    `gorm:"type:text" json:"description"`
	Category    string    `gorm:"type:varchar(100)" json:"category"`
	Condition   string    `gorm:"type:varchar(100)" json:"condition"`
	Location    string    `gorm:"type:varchar(160)" json:"location"`
	MaxDuration string    `gorm:"type:varchar(40)" json:"max_duration"`
	Handover    string    `gorm:"type:varchar(100)" json:"handover"`
	OwnerID     uint      `gorm:"not null" json:"owner_id"`
	Owner       User      `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
	RentalPrice float64   `gorm:"not null" json:"rental_price"`
	Latitude    float64   `json:"latitude"`
	Longitude   float64   `json:"longitude"`
	Status      string    `gorm:"default:'available'" json:"status"`
	CoverURL    string    `json:"cover_url"`
	Embedding   *string   `gorm:"type:vector(384)" json:"-"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Transaction struct {
	ID                 uint      `gorm:"primaryKey" json:"id"`
	BookID             uint      `gorm:"not null" json:"book_id"`
	Book               Book      `gorm:"foreignKey:BookID" json:"book,omitempty"`
	BorrowerID         uint      `gorm:"not null" json:"borrower_id"`
	Borrower           User      `gorm:"foreignKey:BorrowerID" json:"borrower,omitempty"`
	BorrowDate         time.Time `gorm:"not null" json:"borrow_date"`
	ExpectedReturnDate time.Time `gorm:"not null" json:"expected_return_date"`
	Handover           string    `gorm:"type:varchar(100)" json:"handover"`
	Location           string    `gorm:"type:varchar(160)" json:"location"`
	Note               string    `gorm:"type:text" json:"note"`
	Status             string    `gorm:"type:varchar(30);default:'PENDING_APPROVAL'" json:"status"`
	TotalPrice         int       `gorm:"not null" json:"total_price"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

type Notification struct {
	ID        uint       `gorm:"primaryKey" json:"id"`
	UserID    uint       `gorm:"not null;index" json:"user_id"`
	Type      string     `gorm:"type:varchar(40);not null" json:"type"`
	Title     string     `gorm:"type:varchar(180);not null" json:"title"`
	Body      string     `gorm:"type:text" json:"body"`
	Link      string     `gorm:"type:varchar(240)" json:"link"`
	ReadAt    *time.Time `json:"read_at"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

type ChatThread struct {
	ID            uint          `gorm:"primaryKey" json:"id"`
	BookID        *uint         `gorm:"index" json:"book_id"`
	Book          *Book         `gorm:"foreignKey:BookID" json:"book,omitempty"`
	CreatedByID   uint          `gorm:"not null;index" json:"created_by_id"`
	CreatedBy     User          `gorm:"foreignKey:CreatedByID" json:"created_by,omitempty"`
	RecipientID   uint          `gorm:"not null;index" json:"recipient_id"`
	Recipient     User          `gorm:"foreignKey:RecipientID" json:"recipient,omitempty"`
	Messages      []ChatMessage `gorm:"foreignKey:ThreadID" json:"-"`
	LastMessageAt *time.Time    `json:"last_message_at"`
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`
}

type ChatMessage struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	ThreadID  uint      `gorm:"not null;index" json:"thread_id"`
	SenderID  uint      `gorm:"not null;index" json:"sender_id"`
	Sender    User      `gorm:"foreignKey:SenderID" json:"sender,omitempty"`
	Body      string    `gorm:"type:text;not null" json:"body"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
