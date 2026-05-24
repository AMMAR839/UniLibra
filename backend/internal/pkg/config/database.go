package config

import (
	"fmt"
	"log"
	"os"

	"unilibra-backend/internal/pkg/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func ConnectDatabase() {
	host := os.Getenv("DB_HOST")
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	dbname := os.Getenv("DB_NAME")
	port := os.Getenv("DB_PORT")

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=Asia/Jakarta",
		host, user, password, dbname, port)

	database, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Gagal terhubung ke database:", err)
	}

	fmt.Println("Koneksi database berhasil!")

	database.Exec("CREATE EXTENSION IF NOT EXISTS vector")

	err = database.AutoMigrate(
		&models.User{},
		&models.Book{},
		&models.Transaction{},
		&models.BookRating{},
		&models.Notification{},
		&models.ChatThread{},
		&models.ChatMessage{},
	)
	if err != nil {
		log.Fatal("Gagal melakukan Auto-Migrate:", err)
	}
	fmt.Println("Auto-Migrate tabel berhasil!")

	DB = database
}
