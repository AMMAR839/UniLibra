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
	sslmode := os.Getenv("DB_SSLMODE")
	if sslmode == "" {
		sslmode = "disable"
	}

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=Asia/Jakarta default_query_exec_mode=simple_protocol statement_cache_capacity=0",
		host, user, password, dbname, port, sslmode)

	database, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: true,
	}), &gorm.Config{})
	if err != nil {
		log.Fatal("Gagal terhubung ke database:", err)
	}

	fmt.Println("Koneksi database berhasil!")

	database.Exec("CREATE EXTENSION IF NOT EXISTS vector")
	database.Exec("CREATE EXTENSION IF NOT EXISTS pg_trgm")

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
