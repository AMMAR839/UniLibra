package storage

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
)

func SaveCover(file *multipart.FileHeader) (string, error) {
	if file == nil {
		return "", nil
	}

	if err := validateCover(file); err != nil {
		return "", err
	}

	if strings.EqualFold(os.Getenv("STORAGE_PROVIDER"), "azure") {
		return saveAzureCover(file)
	}
	if strings.EqualFold(os.Getenv("STORAGE_PROVIDER"), "supabase") {
		return saveSupabaseCover(file)
	}

	return saveLocalCover(file)
}

func LocalUploadDir() string {
	value := strings.TrimSpace(os.Getenv("UPLOAD_DIR"))
	if value == "" {
		return "uploads"
	}

	return value
}

func validateCover(file *multipart.FileHeader) error {
	if file.Size > 5*1024*1024 {
		return fmt.Errorf("foto cover maksimal 5 MB")
	}

	extension := strings.ToLower(filepath.Ext(file.Filename))
	switch extension {
	case ".jpg", ".jpeg", ".png", ".webp":
		return nil
	default:
		return fmt.Errorf("foto cover harus JPG, PNG, atau WEBP")
	}
}

func saveLocalCover(file *multipart.FileHeader) (string, error) {
	source, err := file.Open()
	if err != nil {
		return "", err
	}
	defer source.Close()

	if err := os.MkdirAll(LocalUploadDir(), 0o755); err != nil {
		return "", err
	}

	filename, err := objectName(file.Filename)
	if err != nil {
		return "", err
	}

	targetPath := filepath.Join(LocalUploadDir(), filename)
	target, err := os.Create(targetPath)
	if err != nil {
		return "", err
	}
	defer target.Close()

	if _, err := io.Copy(target, source); err != nil {
		return "", err
	}

	publicBaseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("UPLOAD_PUBLIC_BASE_URL")), "/")
	if publicBaseURL != "" {
		return publicBaseURL + "/" + filename, nil
	}

	return "/uploads/" + filename, nil
}

func saveAzureCover(file *multipart.FileHeader) (string, error) {
	connectionString := strings.TrimSpace(os.Getenv("AZURE_STORAGE_CONNECTION_STRING"))
	containerName := strings.TrimSpace(os.Getenv("AZURE_STORAGE_CONTAINER"))
	publicBaseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("AZURE_STORAGE_PUBLIC_BASE_URL")), "/")
	if connectionString == "" || containerName == "" || publicBaseURL == "" {
		return "", fmt.Errorf("Azure Blob Storage belum dikonfigurasi lengkap")
	}

	client, err := azblob.NewClientFromConnectionString(connectionString, nil)
	if err != nil {
		return "", err
	}

	filename, err := objectName(file.Filename)
	if err != nil {
		return "", err
	}

	source, err := file.Open()
	if err != nil {
		return "", err
	}
	defer source.Close()

	if _, err := client.UploadStream(context.Background(), containerName, filename, source, nil); err != nil {
		return "", err
	}

	return publicBaseURL + "/" + filename, nil
}

func saveSupabaseCover(file *multipart.FileHeader) (string, error) {
	supabaseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("SUPABASE_URL")), "/")
	serviceRoleKey := strings.TrimSpace(os.Getenv("SUPABASE_SERVICE_ROLE_KEY"))
	bucket := strings.TrimSpace(os.Getenv("SUPABASE_STORAGE_BUCKET"))
	publicBaseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("SUPABASE_STORAGE_PUBLIC_BASE_URL")), "/")
	if bucket == "" {
		bucket = "book-covers"
	}
	if publicBaseURL == "" && supabaseURL != "" {
		publicBaseURL = supabaseURL + "/storage/v1/object/public/" + bucket
	}
	if supabaseURL == "" || serviceRoleKey == "" || publicBaseURL == "" {
		return "", fmt.Errorf("Supabase Storage belum dikonfigurasi lengkap")
	}

	filename, err := objectName(file.Filename)
	if err != nil {
		return "", err
	}

	source, err := file.Open()
	if err != nil {
		return "", err
	}
	defer source.Close()

	request, err := http.NewRequest(
		http.MethodPost,
		supabaseURL+"/storage/v1/object/"+bucket+"/"+filename,
		source,
	)
	if err != nil {
		return "", err
	}

	request.Header.Set("Authorization", "Bearer "+serviceRoleKey)
	request.Header.Set("apikey", serviceRoleKey)
	request.Header.Set("Content-Type", contentTypeForFilename(filename))
	request.Header.Set("x-upsert", "false")

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 512))
		return "", fmt.Errorf("gagal upload cover ke Supabase Storage: %s %s", response.Status, strings.TrimSpace(string(body)))
	}

	return publicBaseURL + "/" + filename, nil
}

func objectName(originalFilename string) (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}

	return "book-cover-" + hex.EncodeToString(bytes) + strings.ToLower(filepath.Ext(originalFilename)), nil
}

func contentTypeForFilename(filename string) string {
	switch strings.ToLower(filepath.Ext(filename)) {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".webp":
		return "image/webp"
	default:
		return "application/octet-stream"
	}
}
