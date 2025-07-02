package validation

import (
	"mime/multipart"
	"testing"
)

func TestNewAudioFileValidator(t *testing.T) {
	maxSize := int64(1024 * 1024) // 1MB
	validator := NewAudioFileValidator(maxSize)
	
	if validator == nil {
		t.Error("Expected non-nil validator")
	}
	
	if validator.maxSize != maxSize {
		t.Errorf("Expected maxSize %d, got %d", maxSize, validator.maxSize)
	}
	
	if len(validator.supportedExtensions) == 0 {
		t.Error("Expected non-empty supported extensions")
	}
}

func TestAudioFileValidator_ValidateFile(t *testing.T) {
	validator := NewAudioFileValidator(1024) // 1KB limit for testing
	
	tests := []struct {
		name        string
		header      *multipart.FileHeader
		expectError bool
	}{
		{
			name:        "nil header",
			header:      nil,
			expectError: true,
		},
		{
			name: "valid file",
			header: &multipart.FileHeader{
				Filename: "test.mp3",
				Size:     512,
			},
			expectError: false,
		},
		{
			name: "file too large",
			header: &multipart.FileHeader{
				Filename: "test.mp3",
				Size:     2048,
			},
			expectError: true,
		},
		{
			name: "invalid extension",
			header: &multipart.FileHeader{
				Filename: "test.txt",
				Size:     512,
			},
			expectError: true,
		},
		{
			name: "empty file",
			header: &multipart.FileHeader{
				Filename: "test.mp3",
				Size:     0,
			},
			expectError: true,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.ValidateFile(tt.header)
			if (err != nil) != tt.expectError {
				t.Errorf("ValidateFile() error = %v, expectError = %v", err, tt.expectError)
			}
		})
	}
}

func TestAudioFileValidator_ValidateExtension(t *testing.T) {
	validator := NewAudioFileValidator(1024*1024)
	
	tests := []struct {
		filename    string
		expectError bool
	}{
		{"test.mp3", false},
		{"test.wav", false},
		{"test.m4a", false},
		{"test.txt", true},
		{"", true},
		{"noextension", true},
	}
	
	for _, tt := range tests {
		t.Run(tt.filename, func(t *testing.T) {
			err := validator.ValidateExtension(tt.filename)
			if (err != nil) != tt.expectError {
				t.Errorf("ValidateExtension(%q) error = %v, expectError = %v", tt.filename, err, tt.expectError)
			}
		})
	}
}

func TestAudioFileValidator_GetSupportedExtensions(t *testing.T) {
	validator := NewAudioFileValidator(1024)
	extensions := validator.GetSupportedExtensions()
	
	if len(extensions) == 0 {
		t.Error("Expected non-empty extensions list")
	}
}