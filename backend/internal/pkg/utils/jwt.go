package utils

import (
	"time"
	"github.com/golang-jwt/jwt/v5"
)

// [SEMENTARA] JWT secret key
var jwtSecret = []byte("kunci_perpustakaan")

// GenerateToken bertugas membuat JWT berdasarkan ID pengguna
func GenerateToken(userID uint) (string, error) {
	// Buat "klaim" JWT dengan ID user dan masa berlaku.
	claims := jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(time.Hour * 24).Unix(), // Kartu ini kedaluwarsa dalam 24 jam
	}

	// Buat token menggunakan algoritma enkripsi HS256
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// Tanda tangani token dengan secret key untuk menghasilkan string token yang aman
	return token.SignedString(jwtSecret)
}
