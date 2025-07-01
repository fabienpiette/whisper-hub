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
		{"/tmp/video.mp4", "/tmp/video_converted.mp3"},
		{"/path/to/movie.avi", "/path/to/movie_converted.mp3"},
		{"video.mkv", "video_converted.mp3"},
		{"/tmp/file.with.dots.mp4", "/tmp/file.with.dots_converted.mp3"},
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
	outputPath := "/tmp/output.mp3"
	duration := 30.0 // 30 minutes
	
	cmd := converter.buildFFmpegCommand(ctx, inputPath, outputPath, duration)
	
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
	
	// Check for essential arguments (bitrate will be adaptive)
	essentialArgs := []string{"-i", inputPath, "-vn", "-acodec", "libmp3lame", "-ar", "16000", "-ac", "1", "-f", "mp3", "-y", outputPath}
	
	for _, expectedArg := range essentialArgs {
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
	
	// Check that bitrate argument exists (should be adaptive)
	bitrateFound := false
	for i, arg := range args {
		if arg == "-b:a" && i+1 < len(args) {
			bitrateFound = true
			break
		}
	}
	if !bitrateFound {
		t.Error("missing -b:a (bitrate) argument")
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

func TestVideoConverter_calculateOptimalBitrate(t *testing.T) {
	converter := NewVideoConverter()
	
	tests := []struct {
		name            string
		durationMinutes float64
		expectedMin     int
		expectedMax     int
	}{
		{"short video (30 min)", 30.0, 64, 64},        // Should use high quality
		{"medium video (90 min)", 90.0, 24, 32},       // Should use medium or calculated
		{"long video (150 min)", 150.0, 24, 27},       // Should use calculated, minimum 24
		{"very long video (300 min)", 300.0, 24, 24},  // Should use minimum quality
		{"unknown duration", 0.0, 64, 64},             // Should use default high quality
		{"unknown duration negative", -1.0, 64, 64},   // Should use default high quality
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := converter.calculateOptimalBitrate(tt.durationMinutes)
			if result < tt.expectedMin || result > tt.expectedMax {
				t.Errorf("calculateOptimalBitrate(%.1f) = %d, want between %d and %d", 
					tt.durationMinutes, result, tt.expectedMin, tt.expectedMax)
			}
		})
	}
}

func TestVideoConverter_estimateAudioFileSize(t *testing.T) {
	converter := NewVideoConverter()
	
	tests := []struct {
		name            string
		durationMinutes float64
		bitrateKbps     int
		expectedSizeMB  float64
		tolerance       float64
	}{
		{"30min at 64kbps", 30.0, 64, 14.4, 0.5},
		{"60min at 32kbps", 60.0, 32, 14.4, 0.5},
		{"120min at 24kbps", 120.0, 24, 21.1, 0.5},
		{"zero duration", 0.0, 64, 0.0, 0.1},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := converter.estimateAudioFileSize(tt.durationMinutes, tt.bitrateKbps)
			resultMB := float64(result) / (1024 * 1024)
			
			if resultMB < tt.expectedSizeMB-tt.tolerance || resultMB > tt.expectedSizeMB+tt.tolerance {
				t.Errorf("estimateAudioFileSize(%.1f, %d) = %.2f MB, want %.2f MB (±%.1f)",
					tt.durationMinutes, tt.bitrateKbps, resultMB, tt.expectedSizeMB, tt.tolerance)
			}
		})
	}
}

func TestVideoConverter_getVideoDurationUnit(t *testing.T) {
	// This is a unit test that doesn't require ffprobe to be installed
	// We're testing the parsing logic by mocking the output
	converter := NewVideoConverter()
	
	// Test the duration calculation logic directly
	// If we had a mock framework, we could test getVideoDuration more thoroughly
	// For now, we test the core calculation in calculateOptimalBitrate
	
	duration := 102.5 // 1 hour 42.5 minutes
	bitrate := converter.calculateOptimalBitrate(duration)
	
	// For a ~102 minute video, we expect a low-medium bitrate to stay under 25MB
	if bitrate > 32 {
		t.Errorf("For 102.5 minute video, expected bitrate <= 32 kbps, got %d", bitrate)
	}
	if bitrate < 24 {
		t.Errorf("For 102.5 minute video, expected bitrate >= 24 kbps, got %d", bitrate)
	}
	
	// Verify the estimated size would be under 25MB
	estimatedSize := converter.estimateAudioFileSize(duration, bitrate)
	estimatedSizeMB := float64(estimatedSize) / (1024 * 1024)
	
	if estimatedSizeMB > 25.0 {
		t.Errorf("Estimated size %.2f MB exceeds 25MB limit for 102.5 minute video at %d kbps",
			estimatedSizeMB, bitrate)
	}
}

// Note: Testing actual video conversion would require ffmpeg to be installed
// and would be more of an integration test. The above tests focus on the
// logic and error handling of the converter without requiring external dependencies.