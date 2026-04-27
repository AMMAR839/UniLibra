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
	ID          uint   `gorm:"primaryKey"`
	OwnerID     uint   `gorm:"not null"`
	Title       string `gorm:"type:varchar(200);not null"`
	Author      string `gorm:"type:varchar(100)"`
	Description string `gorm:"type:text"`
	Genre       string `gorm:"type:varchar(50)"`
	RentalPrice int    `gorm:"not null"`
	CoverURL    string `gorm:"type:varchar(255)"`
	Status      string `gorm:"type:varchar(20);default:'AVAILABLE'"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
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
