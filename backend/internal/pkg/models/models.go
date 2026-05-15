package models

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	ID           uint   `gorm:"primaryKey"`
	Name         string `gorm:"type:varchar(100);not null"`
	Email        string `gorm:"type:varchar(100);uniqueIndex;not null"`
	PasswordHash string `gorm:"not null"`
	PhoneNumber  string `gorm:"type:varchar(20)"`
	Latitude     float64
	Longitude    float64
	CreatedAt    time.Time
	UpdatedAt    time.Time
	DeletedAt    gorm.DeletedAt `gorm:"index"`
}

type Book struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Title       string    `gorm:"not null" json:"title"`
	Author      string    `gorm:"not null" json:"author"`
	Description string    `gorm:"type:text" json:"description"`
	OwnerID     uint      `gorm:"not null" json:"owner_id"`
	RentalPrice float64   `gorm:"not null" json:"rental_price"`
	Latitude    float64   `json:"latitude"`
	Longitude   float64   `json:"longitude"`
	Status      string    `gorm:"default:'available'" json:"status"`
	CoverURL    string    `json:"cover_url"`
	Embedding   string    `gorm:"type:vector(384)" json:"-"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Transaction struct {
	ID                 uint      `gorm:"primaryKey"`
	BookID             uint      `gorm:"not null"`
	BorrowerID         uint      `gorm:"not null"`
	BorrowDate         time.Time `gorm:"not null"`
	ExpectedReturnDate time.Time `gorm:"not null"`
	Status             string    `gorm:"type:varchar(30);default:'PENDING_APPROVAL'"`
	TotalPrice         int       `gorm:"not null"`
	CreatedAt          time.Time
	UpdatedAt          time.Time
}
