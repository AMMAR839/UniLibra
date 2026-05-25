package utils

import (
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func GenerateToken(userID uint) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(time.Hour * 24).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	secretKey := os.Getenv("JWT_SECRET")

	return token.SignedString([]byte(secretKey))
}

func ParseToken(tokenString string) (uint, error) {
	secretKey := os.Getenv("JWT_SECRET")
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("metode token tidak valid")
		}

		return []byte(secretKey), nil
	})
	if err != nil || !token.Valid {
		return 0, fmt.Errorf("token tidak valid")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return 0, fmt.Errorf("claim token tidak valid")
	}

	userID, ok := claims["user_id"].(float64)
	if !ok || userID <= 0 {
		return 0, fmt.Errorf("user token tidak valid")
	}

	return uint(userID), nil
}
