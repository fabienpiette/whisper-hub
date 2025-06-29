package service

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestNewVideoConverter(t *testing.T) {
	converter := NewVideoConverter()
	
	if converter == nil {
		t.Fatal("NewVideoConverter returned nil")
	}
	
	if converter.ffmpegPath != "ffmpeg" {
		t.Errorf("expected ffmpegPath 'ffmpeg', got %s", converter.ffmpegPath)
	}
	
	if converter.timeout != 10*time.Minute {
		t.Errorf("expected timeout 10m, got %v", converter.timeout)
	}
}

func TestVideoConverter_GetConversionTimeout(t *testing.T) {
	converter := NewVideoConverter()
	
	timeout := converter.GetConversionTimeout()
	if timeout != 10*time.Minute {
		t.Errorf("expected timeout 10m, got %v", timeout)
	}
}

func TestVideoConverter_SetConversionTimeout(t *testing.T) {
	converter := NewVideoConverter()
	newTimeout := 3 * time.Minute
	
	converter.SetConversionTimeout(newTimeout)
	
	if converter.timeout != newTimeout {
		t.Errorf("expected timeout %v, got %v", newTimeout, converter.timeout)
	}
	
	if converter.GetConversionTimeout() != newTimeout {
		t.Errorf("GetConversionTimeout() = %v, want %v", converter.GetConversionTimeout(), newTimeout)
	}
}

func TestVideoConverter_generateAudioPath(t *testing.T) {
	converter := NewVideoConverter()
	
	tests := []struct {
		input    string
		expected string
	}{
		{"/tmp/video.mp4", "/tmp/video_converted.wav"},
		{"/path/to/movie.avi", "/path/to/movie_converted.wav"},
		{"video.mkv", "video_converted.wav"},
		{"/tmp/file.with.dots.mp4", "/tmp/file.with.dots_converted.wav"},
	}
	
	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := converter.generateAudioPath(tt.input)
			if result != tt.expected {
				t.Errorf("generateAudioPath(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestVideoConverter_ConvertVideoToAudio_FileNotFound(t *testing.T) {
	converter := NewVideoConverter()
	ctx := context.Background()
	
	nonExistentFile := "/tmp/nonexistent_video_file.mp4"
	
	_, err := converter.ConvertVideoToAudio(ctx, nonExistentFile)
	
	if err == nil {
		t.Error("expected error for non-existent file, got none")
	}
}

func TestVideoConverter_ConvertVideoToAudio_ContextCancellation(t *testing.T) {
	converter := NewVideoConverter()
	
	// Create a temp file to simulate video
	tempDir := t.TempDir()
	videoPath := filepath.Join(tempDir, "test.mp4")
	if err := os.WriteFile(videoPath, []byte("fake video data"), 0644); err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	
	// Create a context that's already cancelled
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	
	_, err := converter.ConvertVideoToAudio(ctx, videoPath)
	
	if err == nil {
		t.Error("expected error for cancelled context, got none")
	}
}

func TestVideoConverter_buildFFmpegCommand(t *testing.T) {
	converter := NewVideoConverter()
	ctx := context.Background()
	
	inputPath := "/tmp/input.mp4"
	outputPath := "/tmp/output.wav"
	
	cmd := converter.buildFFmpegCommand(ctx, inputPath, outputPath)
	
	if cmd == nil {
		t.Fatal("buildFFmpegCommand returned nil")
	}
	
	if cmd.Path != "ffmpeg" && cmd.Path != "/usr/bin/ffmpeg" && cmd.Path != "/usr/local/bin/ffmpeg" {
		// Path resolution may vary by system, just check that it contains ffmpeg
		if cmd.Args[0] != "ffmpeg" {
			t.Errorf("expected command to be ffmpeg, got %s", cmd.Args[0])
		}
	}
	
	args := cmd.Args
	
	// Check for essential arguments
	essentialArgs := []string{"-i", inputPath, "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", "-f", "wav", "-y", outputPath}
	
	for i, expectedArg := range essentialArgs {
		if i+1 >= len(args) || args[i+1] != expectedArg {
			// Find the argument in the slice
			found := false
			for _, arg := range args {
				if arg == expectedArg {
					found = true
					break
				}
			}
			if !found {
				t.Errorf("missing essential argument: %s", expectedArg)
			}
		}
	}
}

func TestVideoConverter_CleanupConvertedFile(t *testing.T) {
	converter := NewVideoConverter()
	
	// Test with empty path
	err := converter.CleanupConvertedFile("")
	if err != nil {
		t.Errorf("CleanupConvertedFile with empty path should not error, got: %v", err)
	}
	
	// Test with non-existent file
	err = converter.CleanupConvertedFile("/tmp/nonexistent.wav")
	if err != nil {
		t.Errorf("CleanupConvertedFile with non-existent file should not error, got: %v", err)
	}
	
	// Test with existing file
	tempDir := t.TempDir()
	tempFile := filepath.Join(tempDir, "test_converted.wav")
	if err := os.WriteFile(tempFile, []byte("test data"), 0644); err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	
	err = converter.CleanupConvertedFile(tempFile)
	if err != nil {
		t.Errorf("CleanupConvertedFile with existing file failed: %v", err)
	}
	
	// Verify file was deleted
	if _, err := os.Stat(tempFile); !os.IsNotExist(err) {
		t.Error("file should have been deleted")
	}
}

// Note: Testing actual video conversion would require ffmpeg to be installed
// and would be more of an integration test. The above tests focus on the
// logic and error handling of the converter without requiring external dependencies.