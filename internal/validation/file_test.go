package validation

import (
	"mime/multipart"
	"testing"

	"whisper-hub/internal/constants"
)

func TestNewFileValidator(t *testing.T) {
	maxAudioSize := int64(1024 * 1024)
	validator := NewFileValidator(maxAudioSize)

	if validator == nil {
		t.Fatal("NewFileValidator returned nil")
	}

	if validator.maxAudioSize != maxAudioSize {
		t.Errorf("expected maxAudioSize %d, got %d", maxAudioSize, validator.maxAudioSize)
	}

	if validator.maxVideoSize != constants.MaxVideoFileSize {
		t.Errorf("expected maxVideoSize %d, got %d", constants.MaxVideoFileSize, validator.maxVideoSize)
	}

	if len(validator.audioExtensions) == 0 {
		t.Error("audioExtensions should not be empty")
	}

	if len(validator.videoExtensions) == 0 {
		t.Error("videoExtensions should not be empty")
	}
}

func TestFileValidator_GetFileType(t *testing.T) {
	validator := NewFileValidator(1024 * 1024)

	tests := []struct {
		filename string
		expected FileType
	}{
		// Audio files
		{"test.mp3", FileTypeAudio},
		{"test.MP3", FileTypeAudio},
		{"test.wav", FileTypeAudio},
		{"test.WAV", FileTypeAudio},
		{"test.m4a", FileTypeAudio},
		{"test.ogg", FileTypeAudio},
		{"test.flac", FileTypeAudio},
		{"test.aac", FileTypeAudio},

		// Video files
		{"test.mp4", FileTypeVideo},
		{"test.MP4", FileTypeVideo},
		{"test.avi", FileTypeVideo},
		{"test.AVI", FileTypeVideo},
		{"test.mov", FileTypeVideo},
		{"test.mkv", FileTypeVideo},
		{"test.webm", FileTypeVideo},
		{"test.flv", FileTypeVideo},
		{"test.wmv", FileTypeVideo},
		{"test.m4v", FileTypeVideo},

		// Unknown files
		{"test.txt", FileTypeUnknown},
		{"test.jpg", FileTypeUnknown},
		{"test.pdf", FileTypeUnknown},
		{"test", FileTypeUnknown},
		{"", FileTypeUnknown},
		{"audio.mp3.txt", FileTypeUnknown},
	}

	for _, tt := range tests {
		t.Run(tt.filename, func(t *testing.T) {
			result := validator.GetFileType(tt.filename)
			if result != tt.expected {
				t.Errorf("GetFileType(%q) = %v, want %v", tt.filename, result, tt.expected)
			}
		})
	}
}

func TestFileValidator_IsAudioFile(t *testing.T) {
	validator := NewFileValidator(1024 * 1024)

	tests := []struct {
		filename string
		expected bool
	}{
		{"test.mp3", true},
		{"test.wav", true},
		{"test.mp4", false},
		{"test.txt", false},
	}

	for _, tt := range tests {
		t.Run(tt.filename, func(t *testing.T) {
			result := validator.IsAudioFile(tt.filename)
			if result != tt.expected {
				t.Errorf("IsAudioFile(%q) = %v, want %v", tt.filename, result, tt.expected)
			}
		})
	}
}

func TestFileValidator_IsVideoFile(t *testing.T) {
	validator := NewFileValidator(1024 * 1024)

	tests := []struct {
		filename string
		expected bool
	}{
		{"test.mp4", true},
		{"test.avi", true},
		{"test.mp3", false},
		{"test.txt", false},
	}

	for _, tt := range tests {
		t.Run(tt.filename, func(t *testing.T) {
			result := validator.IsVideoFile(tt.filename)
			if result != tt.expected {
				t.Errorf("IsVideoFile(%q) = %v, want %v", tt.filename, result, tt.expected)
			}
		})
	}
}

func TestFileValidator_ValidateFile(t *testing.T) {
	maxAudioSize := int64(1024 * 1024) // 1MB
	validator := NewFileValidator(maxAudioSize)

	tests := []struct {
		name     string
		header   *multipart.FileHeader
		wantErr  bool
		errCheck func(error) bool
	}{
		{
			name: "valid audio file",
			header: &multipart.FileHeader{
				Filename: "test.mp3",
				Size:     1000,
			},
			wantErr: false,
		},
		{
			name: "valid video file",
			header: &multipart.FileHeader{
				Filename: "test.mp4",
				Size:     1000,
			},
			wantErr: false,
		},
		{
			name: "large video file within limit",
			header: &multipart.FileHeader{
				Filename: "test.mp4",
				Size:     1024 * 1024 * 1024, // 1GB
			},
			wantErr: false,
		},
		{
			name:    "nil header",
			header:  nil,
			wantErr: true,
		},
		{
			name: "empty filename",
			header: &multipart.FileHeader{
				Filename: "",
				Size:     1000,
			},
			wantErr: true,
		},
		{
			name: "invalid extension",
			header: &multipart.FileHeader{
				Filename: "test.txt",
				Size:     1000,
			},
			wantErr: true,
			errCheck: func(err error) bool {
				return err.Error() != "" // Just check that error exists, validation errors are wrapped
			},
		},
		{
			name: "audio file too large",
			header: &multipart.FileHeader{
				Filename: "test.mp3",
				Size:     maxAudioSize + 1,
			},
			wantErr: true,
			errCheck: func(err error) bool {
				return err.Error() != "" // Just check that error exists, validation errors are wrapped
			},
		},
		{
			name: "video file too large",
			header: &multipart.FileHeader{
				Filename: "test.mp4",
				Size:     constants.MaxVideoFileSize + 1,
			},
			wantErr: true,
			errCheck: func(err error) bool {
				return err.Error() != "" // Just check that error exists, validation errors are wrapped
			},
		},
		{
			name: "empty file",
			header: &multipart.FileHeader{
				Filename: "test.mp3",
				Size:     0,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.ValidateFile(tt.header)

			if tt.wantErr {
				if err == nil {
					t.Error("expected error, got none")
				} else if tt.errCheck != nil && !tt.errCheck(err) {
					t.Errorf("error check failed: %v", err)
				}
			} else {
				if err != nil {
					t.Errorf("expected no error, got: %v", err)
				}
			}
		})
	}
}

func TestFileValidator_GetSupportedExtensions(t *testing.T) {
	validator := NewFileValidator(1024 * 1024)

	audioExts, videoExts := validator.GetSupportedExtensions()

	if len(audioExts) == 0 {
		t.Error("audio extensions should not be empty")
	}

	if len(videoExts) == 0 {
		t.Error("video extensions should not be empty")
	}

	// Check that constants match
	if len(audioExts) != len(constants.SupportedAudioExtensions) {
		t.Error("audio extensions length mismatch with constants")
	}

	if len(videoExts) != len(constants.SupportedVideoExtensions) {
		t.Error("video extensions length mismatch with constants")
	}
}
