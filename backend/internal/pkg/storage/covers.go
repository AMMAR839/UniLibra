package storage

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"mime/multipart"
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

func objectName(originalFilename string) (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}

	return "book-cover-" + hex.EncodeToString(bytes) + strings.ToLower(filepath.Ext(originalFilename)), nil
}
