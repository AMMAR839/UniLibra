package config

import (
	"fmt"
	"log"
	
	"unilibra-backend/internal/pkg/models" 

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func ConnectDatabase() {
	// Kredensial sama dengan deployments/docker-compose.yml
	dsn := "host=localhost user=root password=secretpassword dbname=unilibra_db port=5432 sslmode=disable"
	
	database, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Gagal terhubung ke database:", err)
	}

	fmt.Println("Koneksi database berhasil!")

	// Membuat tabel berdasarkan struct di folder models dengan AutoMigrate
	err = database.AutoMigrate(&models.User{}, &models.Book{}, &models.Transaction{})
	if err != nil {
		log.Fatal("Gagal melakukan Auto-Migrate:", err)
	}

	fmt.Println("Auto-Migrate tabel berhasil!")
	DB = database
}
