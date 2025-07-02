package storage

import (
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"time"
)

type TempFileManager struct {
	tempDir string
}

func NewTempFileManager(tempDir string) *TempFileManager {
	return &TempFileManager{
		tempDir: tempDir,
	}
}

func (t *TempFileManager) SaveUploadedFile(file multipart.File, header *multipart.FileHeader) (string, error) {
	timestamp := time.Now().Unix()
	filename := fmt.Sprintf("%d_%s", timestamp, header.Filename)
	filePath := filepath.Join(t.tempDir, filename)

	dst, err := os.Create(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to create temp file: %w", err)
	}
	defer dst.Close()

	_, err = io.Copy(dst, file)
	if err != nil {
		os.Remove(filePath)
		return "", fmt.Errorf("failed to save file: %w", err)
	}

	return filePath, nil
}

func (t *TempFileManager) Cleanup(filePath string) error {
	return os.Remove(filePath)
}
