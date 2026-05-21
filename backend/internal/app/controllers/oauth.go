package controllers

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"unilibra-backend/internal/pkg/config"
	"unilibra-backend/internal/pkg/models"
	"unilibra-backend/internal/pkg/utils"

	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

const googleOAuthStateCookie = "unilibra_google_state"

type googleUserInfo struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	Name          string `json:"name"`
	VerifiedEmail bool   `json:"verified_email"`
}

func StartGoogleOAuth(c *gin.Context) {
	oauthConfig, err := googleOAuthConfig()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
		return
	}

	state, err := randomState()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyiapkan sesi Google OAuth."})
		return
	}

	http.SetCookie(c.Writer, &http.Cookie{
		Name:     googleOAuthStateCookie,
		Value:    state,
		Path:     "/api/auth/google",
		MaxAge:   600,
		Expires:  time.Now().Add(10 * time.Minute),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   requestUsesHTTPS(c),
	})

	c.Redirect(http.StatusTemporaryRedirect, oauthConfig.AuthCodeURL(state))
}

func FinishGoogleOAuth(c *gin.Context) {
	oauthConfig, err := googleOAuthConfig()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
		return
	}

	stateCookie, cookieErr := c.Request.Cookie(googleOAuthStateCookie)
	if cookieErr != nil || stateCookie.Value == "" || stateCookie.Value != c.Query("state") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "State Google OAuth tidak valid."})
		return
	}

	code := strings.TrimSpace(c.Query("code"))
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode Google OAuth tidak ditemukan."})
		return
	}

	token, err := oauthConfig.Exchange(context.Background(), code)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Google OAuth gagal menukar kode login."})
		return
	}

	userInfo, err := fetchGoogleUserInfo(oauthConfig.Client(context.Background(), token))
	if err != nil || userInfo.Email == "" || !userInfo.VerifiedEmail {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Profil Google belum dapat diverifikasi."})
		return
	}

	user, err := findOrCreateGoogleUser(userInfo)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan akun Google."})
		return
	}

	jwtToken, err := utils.GenerateToken(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat token autentikasi."})
		return
	}

	callbackURL := strings.TrimRight(frontendURL(), "/") + "/auth/callback"
	c.Redirect(http.StatusTemporaryRedirect, callbackURL+"#token="+url.QueryEscape(jwtToken))
}

func googleOAuthConfig() (*oauth2.Config, error) {
	clientID := strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_ID"))
	clientSecret := strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_SECRET"))
	redirectURL := strings.TrimSpace(os.Getenv("GOOGLE_REDIRECT_URL"))
	if redirectURL == "" {
		redirectURL = "http://localhost:8080/api/auth/google/callback"
	}

	if clientID == "" || clientSecret == "" {
		return nil, fmt.Errorf("Google OAuth belum dikonfigurasi di backend")
	}

	return &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  redirectURL,
		Scopes:       []string{"openid", "email", "profile"},
		Endpoint:     google.Endpoint,
	}, nil
}

func fetchGoogleUserInfo(client *http.Client) (googleUserInfo, error) {
	response, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		return googleUserInfo{}, err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return googleUserInfo{}, fmt.Errorf("google userinfo returned %d", response.StatusCode)
	}

	var info googleUserInfo
	if err := json.NewDecoder(response.Body).Decode(&info); err != nil {
		return googleUserInfo{}, err
	}

	return info, nil
}

func findOrCreateGoogleUser(info googleUserInfo) (models.User, error) {
	var user models.User
	if err := config.DB.Where("google_id = ?", info.ID).First(&user).Error; err == nil {
		return user, nil
	}

	if err := config.DB.Where("email = ?", info.Email).First(&user).Error; err == nil {
		user.GoogleID = &info.ID
		if user.Role == "" {
			user.Role = roleForEmail(info.Email)
		}
		if user.Status == "" {
			user.Status = "active"
		}
		return user, config.DB.Save(&user).Error
	}

	user = models.User{
		Name:     info.Name,
		Email:    info.Email,
		GoogleID: &info.ID,
		Role:     roleForEmail(info.Email),
		Status:   "active",
	}
	return user, config.DB.Create(&user).Error
}

func frontendURL() string {
	value := strings.TrimSpace(os.Getenv("FRONTEND_URL"))
	if value == "" {
		return "http://localhost:5173"
	}

	return value
}

func randomState() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

func requestUsesHTTPS(c *gin.Context) bool {
	return c.Request.TLS != nil || strings.EqualFold(c.GetHeader("X-Forwarded-Proto"), "https")
}
