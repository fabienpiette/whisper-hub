package storage

import (
	"bytes"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestNewTempFileManager(t *testing.T) {
	tempDir := "/tmp/test"
	manager := NewTempFileManager(tempDir)

	if manager == nil {
		t.Fatal("NewTempFileManager returned nil")
	}

	if manager.tempDir != tempDir {
		t.Errorf("expected tempDir %q, got %q", tempDir, manager.tempDir)
	}
}

func TestTempFileManager_SaveUploadedFile(t *testing.T) {
	// Create temp directory for testing
	tempDir, err := os.MkdirTemp("", "test-temp")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	manager := NewTempFileManager(tempDir)

	tests := []struct {
		name        string
		fileContent string
		filename    string
		wantErr     bool
	}{
		{
			name:        "valid file",
			fileContent: "test audio content",
			filename:    "test.mp3",
			wantErr:     false,
		},
		{
			name:        "empty file",
			fileContent: "",
			filename:    "empty.wav",
			wantErr:     false,
		},
		{
			name:        "file with special chars",
			fileContent: "content",
			filename:    "test file (1).mp3",
			wantErr:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a multipart file
			body := &bytes.Buffer{}
			writer := multipart.NewWriter(body)
			part, err := writer.CreateFormFile("audio", tt.filename)
			if err != nil {
				t.Fatalf("failed to create form file: %v", err)
			}
			part.Write([]byte(tt.fileContent))
			writer.Close()

			// Parse the multipart form
			reader := multipart.NewReader(body, writer.Boundary())
			form, err := reader.ReadForm(10 << 20) // 10MB max
			if err != nil {
				t.Fatalf("failed to read form: %v", err)
			}
			defer form.RemoveAll()

			// Get the file from the form
			files := form.File["audio"]
			if len(files) == 0 {
				t.Fatal("no files in form")
			}

			file, err := files[0].Open()
			if err != nil {
				t.Fatalf("failed to open file: %v", err)
			}
			defer file.Close()

			// Test SaveUploadedFile
			filePath, err := manager.SaveUploadedFile(file, files[0])

			if (err != nil) != tt.wantErr {
				t.Errorf("SaveUploadedFile() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				// Verify file was created
				if _, err := os.Stat(filePath); os.IsNotExist(err) {
					t.Error("file was not created")
				}

				// Verify file content
				content, err := os.ReadFile(filePath)
				if err != nil {
					t.Errorf("failed to read saved file: %v", err)
				}
				if string(content) != tt.fileContent {
					t.Errorf("file content = %q, want %q", string(content), tt.fileContent)
				}

				// Verify filename contains original name
				if !strings.Contains(filepath.Base(filePath), tt.filename) {
					t.Errorf("saved filename should contain original filename %q, got %q", tt.filename, filePath)
				}

				// Clean up
				os.Remove(filePath)
			}
		})
	}
}

func TestTempFileManager_SaveUploadedFile_InvalidDir(t *testing.T) {
	// Use a non-existent directory
	manager := NewTempFileManager("/path/that/does/not/exist")

	// Create a dummy multipart file
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, _ := writer.CreateFormFile("audio", "test.mp3")
	part.Write([]byte("test"))
	writer.Close()

	reader := multipart.NewReader(body, writer.Boundary())
	form, _ := reader.ReadForm(10 << 20)
	defer form.RemoveAll()

	files := form.File["audio"]
	file, _ := files[0].Open()
	defer file.Close()

	_, err := manager.SaveUploadedFile(file, files[0])
	if err == nil {
		t.Error("expected error for invalid directory")
	}
}

func TestTempFileManager_Cleanup(t *testing.T) {
	// Create temp directory for testing
	tempDir, err := os.MkdirTemp("", "test-cleanup")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	manager := NewTempFileManager(tempDir)

	// Create a test file
	testFile := filepath.Join(tempDir, "test-cleanup.txt")
	err = os.WriteFile(testFile, []byte("test content"), 0644)
	if err != nil {
		t.Fatalf("failed to create test file: %v", err)
	}

	// Verify file exists
	if _, err := os.Stat(testFile); os.IsNotExist(err) {
		t.Fatal("test file should exist")
	}

	// Test cleanup
	err = manager.Cleanup(testFile)
	if err != nil {
		t.Errorf("Cleanup() error = %v", err)
	}

	// Verify file was removed
	if _, err := os.Stat(testFile); !os.IsNotExist(err) {
		t.Error("file should have been removed")
	}
}

func TestTempFileManager_Cleanup_NonExistentFile(t *testing.T) {
	manager := NewTempFileManager(os.TempDir())

	// Try to cleanup a file that doesn't exist
	err := manager.Cleanup("/path/that/does/not/exist.txt")
	if err == nil {
		t.Error("expected error for non-existent file")
	}
}

func TestTempFileManager_SaveUploadedFile_CopyError(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "test-copy-error")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	manager := NewTempFileManager(tempDir)

	// Create a reader that will cause an error
	errorReader := &errorReader{}
	filename := "test.mp3"
	header := &multipart.FileHeader{
		Filename: filename,
		Size:     10,
	}

	_, err = manager.SaveUploadedFile(errorReader, header)
	if err == nil {
		t.Error("expected error from copy operation")
	}
}

// errorReader implements multipart.File and always returns an error
type errorReader struct{}

func (e *errorReader) Read(p []byte) (n int, err error) {
	return 0, io.ErrUnexpectedEOF
}

func (e *errorReader) ReadAt(p []byte, off int64) (n int, err error) {
	return 0, io.ErrUnexpectedEOF
}

func (e *errorReader) Seek(offset int64, whence int) (int64, error) {
	return 0, io.ErrUnexpectedEOF
}

func (e *errorReader) Close() error {
	return nil
}
