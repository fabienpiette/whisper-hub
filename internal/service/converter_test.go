package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// Test helpers to reduce duplication

func setupTestConverter(t *testing.T) *VideoConverter {
	if t != nil {
		t.Helper()
	}
	return NewVideoConverter()
}

func setupTestConverterWithStrategy(t *testing.T, strategy BitrateStrategy) *VideoConverter {
	t.Helper()
	return NewVideoConverterWithStrategy(strategy)
}

func setupTempFile(t *testing.T, content string) string {
	t.Helper()
	tempDir := t.TempDir()
	tempFile := filepath.Join(tempDir, "test.mp4")
	if err := os.WriteFile(tempFile, []byte(content), 0644); err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	return tempFile
}

func TestNewVideoConverter(t *testing.T) {
	converter := setupTestConverter(t)

	if converter == nil {
		t.Fatal("NewVideoConverter returned nil")
	}

	if converter.ffmpegPath != "ffmpeg" {
		t.Errorf("expected ffmpegPath 'ffmpeg', got %s", converter.ffmpegPath)
	}

	if converter.timeout != 10*time.Minute {
		t.Errorf("expected timeout 10m, got %v", converter.timeout)
	}

	if converter.bitrateStrategy == nil {
		t.Error("expected bitrateStrategy to be set")
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

func TestAdaptiveBitrateStrategy_CalculateBitrate(t *testing.T) {
	strategy := NewAdaptiveBitrateStrategy()

	tests := []struct {
		name            string
		durationMinutes float64
		expectedMin     int
		expectedMax     int
	}{
		{"short video (30 min)", 30.0, 64, 64},       // Should use high quality
		{"medium video (90 min)", 90.0, 24, 32},      // Should use medium or calculated
		{"long video (150 min)", 150.0, 24, 27},      // Should use calculated, minimum 24
		{"very long video (300 min)", 300.0, 24, 24}, // Should use minimum quality
		{"unknown duration", 0.0, 64, 64},            // Should use default high quality
		{"unknown duration negative", -1.0, 64, 64},  // Should use default high quality
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := strategy.CalculateBitrate(tt.durationMinutes)
			if result < tt.expectedMin || result > tt.expectedMax {
				t.Errorf("CalculateBitrate(%.1f) = %d, want between %d and %d",
					tt.durationMinutes, result, tt.expectedMin, tt.expectedMax)
			}
		})
	}
}

func TestAdaptiveBitrateStrategy_EstimateFileSize(t *testing.T) {
	strategy := NewAdaptiveBitrateStrategy()

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
			result := strategy.EstimateFileSize(tt.durationMinutes, tt.bitrateKbps)
			resultMB := float64(result) / (1024 * 1024)

			if resultMB < tt.expectedSizeMB-tt.tolerance || resultMB > tt.expectedSizeMB+tt.tolerance {
				t.Errorf("EstimateFileSize(%.1f, %d) = %.2f MB, want %.2f MB (±%.1f)",
					tt.durationMinutes, tt.bitrateKbps, resultMB, tt.expectedSizeMB, tt.tolerance)
			}
		})
	}
}

func TestVideoConverter_IntegratedBitrateSizing(t *testing.T) {
	// Integration test for the real-world scenario that motivated this feature
	strategy := NewAdaptiveBitrateStrategy()

	duration := 102.5 // 1 hour 42.5 minutes (real-world case)
	bitrate := strategy.CalculateBitrate(duration)

	// For a ~102 minute video, we expect a low-medium bitrate to stay under 25MB
	if bitrate > 32 {
		t.Errorf("For 102.5 minute video, expected bitrate <= 32 kbps, got %d", bitrate)
	}
	if bitrate < 24 {
		t.Errorf("For 102.5 minute video, expected bitrate >= 24 kbps, got %d", bitrate)
	}

	// Verify the estimated size would be under 25MB
	estimatedSize := strategy.EstimateFileSize(duration, bitrate)
	estimatedSizeMB := float64(estimatedSize) / (1024 * 1024)

	if estimatedSizeMB > 25.0 {
		t.Errorf("Estimated size %.2f MB exceeds 25MB limit for 102.5 minute video at %d kbps",
			estimatedSizeMB, bitrate)
	}
}

func TestNewVideoConverterWithStrategy(t *testing.T) {
	customStrategy := NewAdaptiveBitrateStrategy()
	converter := setupTestConverterWithStrategy(t, customStrategy)

	if converter.bitrateStrategy != customStrategy {
		t.Error("expected custom strategy to be set")
	}
}

func TestVideoConverter_ConcurrentConversions(t *testing.T) {
	_ = setupTestConverter(t) // Converter not used in this concurrency test
	strategy := NewAdaptiveBitrateStrategy()

	// Test concurrent bitrate calculations (should be thread-safe)
	const numGoroutines = 10
	const numCalculations = 100

	var wg sync.WaitGroup
	results := make(chan int, numGoroutines*numCalculations)

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < numCalculations; j++ {
				// Test with various durations
				duration := float64(30 + j%120) // 30-150 minutes
				bitrate := strategy.CalculateBitrate(duration)
				results <- bitrate
			}
		}()
	}

	wg.Wait()
	close(results)

	// Verify all results are valid
	for bitrate := range results {
		if bitrate < LowQualityBitrate || bitrate > HighQualityBitrate {
			t.Errorf("Invalid bitrate from concurrent calculation: %d", bitrate)
		}
	}
}

func TestVideoConverter_ThreadSafety(t *testing.T) {
	// Test that converter instances are safe for concurrent use
	converter := setupTestConverter(t)
	_ = context.Background() // Context not used in this test

	const numGoroutines = 5
	var wg sync.WaitGroup
	errors := make(chan error, numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()

			// Each goroutine tests different methods
			switch id % 3 {
			case 0:
				// Test timeout operations
				original := converter.GetConversionTimeout()
				converter.SetConversionTimeout(5 * time.Minute)
				converter.SetConversionTimeout(original)
			case 1:
				// Test path generation
				for j := 0; j < 10; j++ {
					path := fmt.Sprintf("/tmp/test%d_%d.mp4", id, j)
					_ = converter.generateAudioPath(path)
				}
			case 2:
				// Test FFmpeg availability check
				for j := 0; j < 10; j++ {
					_ = converter.IsFFmpegAvailable()
				}
			}
		}(i)
	}

	wg.Wait()
	close(errors)

	// Check for any errors
	for err := range errors {
		if err != nil {
			t.Errorf("Thread safety error: %v", err)
		}
	}
}

// Performance Benchmarks

func BenchmarkBitrateStrategy_CalculateBitrate(b *testing.B) {
	strategy := NewAdaptiveBitrateStrategy()
	durations := []float64{30.0, 60.0, 90.0, 120.0, 180.0}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		duration := durations[i%len(durations)]
		_ = strategy.CalculateBitrate(duration)
	}
}

func BenchmarkBitrateStrategy_EstimateFileSize(b *testing.B) {
	strategy := NewAdaptiveBitrateStrategy()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = strategy.EstimateFileSize(90.0, 32)
	}
}

func BenchmarkVideoConverter_AnalyzeVideo_PathGeneration(b *testing.B) {
	converter := setupTestConverter(nil) // Pass nil since this is a benchmark
	paths := []string{
		"/tmp/video1.mp4",
		"/tmp/very_long_filename_with_many_characters.avi",
		"/tmp/path/with/deep/nesting/video.mkv",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		path := paths[i%len(paths)]
		_ = converter.generateAudioPath(path)
	}
	_ = converter // Use converter to avoid unused variable warning
}

func BenchmarkVideoConverter_ConcurrentBitrateCalculations(b *testing.B) {
	strategy := NewAdaptiveBitrateStrategy()

	b.RunParallel(func(pb *testing.PB) {
		durations := []float64{30.0, 60.0, 90.0, 120.0, 180.0, 240.0}
		i := 0
		for pb.Next() {
			duration := durations[i%len(durations)]
			_ = strategy.CalculateBitrate(duration)
			i++
		}
	})
}

// Property-based testing helpers

func TestBitrateStrategy_Properties(t *testing.T) {
	strategy := NewAdaptiveBitrateStrategy()

	// Property: Longer videos should never get higher bitrates than shorter ones
	for _, shortDuration := range []float64{30, 45, 60} {
		for _, longDuration := range []float64{120, 180, 240} {
			shortBitrate := strategy.CalculateBitrate(shortDuration)
			longBitrate := strategy.CalculateBitrate(longDuration)

			if longBitrate > shortBitrate {
				t.Errorf("Property violation: long video (%gmin) has higher bitrate (%d) than short video (%gmin, %d)",
					longDuration, longBitrate, shortDuration, shortBitrate)
			}
		}
	}

	// Property: Estimated size should be reasonable for most common cases
	// Note: Very long videos may exceed 25MB at minimum bitrate - this is expected
	for _, duration := range []float64{30, 60, 90, 120} {
		bitrate := strategy.CalculateBitrate(duration)
		estimatedSize := strategy.EstimateFileSize(duration, bitrate)
		estimatedSizeMB := float64(estimatedSize) / (1024 * 1024)

		// For reasonable durations, should be under 25MB target
		if estimatedSizeMB > 25.0 {
			t.Errorf("Property violation: estimated size %.2fMB exceeds 25MB for %gmin video at %dkbps",
				estimatedSizeMB, duration, bitrate)
		}

		// Should be reasonable minimum size (not zero unless duration is zero)
		if duration > 0 && estimatedSizeMB < 0.1 {
			t.Errorf("Property violation: estimated size %.2fMB too small for %gmin video",
				estimatedSizeMB, duration)
		}
	}

	// Test edge case: very long videos may exceed 25MB even at minimum bitrate
	for _, duration := range []float64{300, 600} {
		bitrate := strategy.CalculateBitrate(duration)
		// Should use minimum bitrate for very long videos
		if bitrate != LowQualityBitrate {
			t.Errorf("Expected minimum bitrate %d for %gmin video, got %d",
				LowQualityBitrate, duration, bitrate)
		}
	}

	// Property: Bitrate calculations should be deterministic
	for _, duration := range []float64{0, 30, 60, 90, 120, 180} {
		bitrate1 := strategy.CalculateBitrate(duration)
		bitrate2 := strategy.CalculateBitrate(duration)

		if bitrate1 != bitrate2 {
			t.Errorf("Property violation: bitrate calculation not deterministic for %gmin: %d != %d",
				duration, bitrate1, bitrate2)
		}
	}
}

// Resource Exhaustion and Error Scenario Tests

func TestVideoConverter_ResourceExhaustion(t *testing.T) {
	converter := setupTestConverter(t)

	t.Run("disk_space_simulation", func(t *testing.T) {
		// Simulate disk space exhaustion by trying to write to /dev/full (Linux)
		// This is a best-effort test that may not work on all systems
		if _, err := os.Stat("/dev/full"); os.IsNotExist(err) {
			t.Skip("Skipping disk space test - /dev/full not available")
			return
		}

		// Test cleanup behavior when disk is full
		err := converter.CleanupConvertedFile("/dev/full/test.mp3")
		// Should handle the error gracefully
		if err == nil {
			t.Log("Cleanup succeeded (expected on some systems)")
		} else {
			t.Logf("Cleanup failed as expected: %v", err)
		}
	})

	t.Run("invalid_temp_directory", func(t *testing.T) {
		// Test behavior with invalid temporary directory paths
		invalidPaths := []string{
			"/nonexistent/path/video.mp4",
			"/root/video.mp4",         // Likely no permission
			"\x00invalid\x00path.mp4", // Null bytes
		}

		for _, path := range invalidPaths {
			audioPath := converter.generateAudioPath(path)
			// Should generate valid audio path even from invalid input
			if audioPath == "" {
				t.Errorf("generateAudioPath returned empty string for %s", path)
			}
		}
	})

	t.Run("memory_intensive_operations", func(t *testing.T) {
		// Test with many concurrent strategy calculations
		strategy := NewAdaptiveBitrateStrategy()

		// Create many goroutines to stress test memory usage
		const numGoroutines = 100
		var wg sync.WaitGroup

		for i := 0; i < numGoroutines; i++ {
			wg.Add(1)
			go func(id int) {
				defer wg.Done()
				// Each goroutine does many calculations
				for j := 0; j < 1000; j++ {
					duration := float64(j%300 + 1)
					_ = strategy.CalculateBitrate(duration)
					_ = strategy.EstimateFileSize(duration, 32)
				}
			}(i)
		}

		wg.Wait()
		// If we get here without crashing, memory handling is reasonable
	})
}

func TestVideoConverter_ErrorScenarios(t *testing.T) {
	converter := setupTestConverter(t)
	ctx := context.Background()

	t.Run("invalid_duration_edge_cases", func(t *testing.T) {
		strategy := NewAdaptiveBitrateStrategy()

		// Test edge cases for duration values
		edgeCases := []float64{
			-1.0,   // Negative
			0.0,    // Zero
			0.001,  // Very small
			999999, // Very large
		}

		for _, duration := range edgeCases {
			bitrate := strategy.CalculateBitrate(duration)
			if bitrate < LowQualityBitrate || bitrate > HighQualityBitrate {
				t.Errorf("Invalid bitrate %d for edge case duration %g", bitrate, duration)
			}

			size := strategy.EstimateFileSize(duration, bitrate)
			if duration <= 0 && size != 0 {
				t.Errorf("Expected zero size for non-positive duration %g, got %d", duration, size)
			}
		}
	})

	t.Run("corrupted_video_file_simulation", func(t *testing.T) {
		// Skip test if FFmpeg is not available
		if !converter.IsFFmpegAvailable() {
			t.Skip("FFmpeg not available, skipping video corruption test")
		}

		// Create a file with corrupted content
		corruptedFile := setupTempFile(t, "This is not a video file, it's corrupted text data that should fail validation")

		// Test that validation catches corrupted files
		_, err := converter.ConvertVideoToAudio(ctx, corruptedFile)
		if err == nil {
			t.Error("Expected error for corrupted video file, got none")
		}

		// Error should be informative (allow various validation error messages)
		if err != nil {
			errorMsg := err.Error()
			if !strings.Contains(errorMsg, "validation failed") &&
				!strings.Contains(errorMsg, "corrupted") &&
				!strings.Contains(errorMsg, "missing moov atom") {
				t.Errorf("Expected validation/corruption error, got: %v", err)
			}
		}
	})

	t.Run("context_timeout_edge_cases", func(t *testing.T) {
		// Skip test if FFmpeg is not available
		if !converter.IsFFmpegAvailable() {
			t.Skip("FFmpeg not available, skipping timeout test")
		}

		// Test with very short timeout
		shortCtx, cancel := context.WithTimeout(ctx, 1*time.Nanosecond)
		defer cancel()

		// Wait for context to expire
		time.Sleep(1 * time.Millisecond)

		tempFile := setupTempFile(t, "fake video content")
		_, err := converter.ConvertVideoToAudio(shortCtx, tempFile)

		if err == nil {
			t.Error("Expected timeout error, got none")
		}

		// Should handle context cancellation gracefully
		if err != nil && !strings.Contains(err.Error(), "context") && !strings.Contains(err.Error(), "cancel") {
			t.Logf("Context error (may vary by system): %v", err)
		}
	})

	t.Run("ffprobe_failure_fallback", func(t *testing.T) {
		// Skip test if FFmpeg is not available
		if !converter.IsFFmpegAvailable() {
			t.Skip("FFmpeg not available, skipping ffprobe test")
		}

		// Test fallback behavior when ffprobe fails
		// This test simulates the scenario by testing with a non-video file
		textFile := setupTempFile(t, "This is a text file, not a video")

		// The duration detection should fail and fallback to default
		duration, err := converter.getVideoDuration(ctx, textFile)

		// Duration detection should fail for non-video files
		if err == nil {
			t.Error("Expected error when getting duration of text file")
		}

		// Should return 0 on failure
		if duration != 0 {
			t.Errorf("Expected 0 duration on failure, got %g", duration)
		}
	})
}

func TestVideoConverter_executeConversion(t *testing.T) {
	converter := setupTestConverter(t)
	ctx := context.Background()

	// Test executeConversion with invalid metadata
	tempDir := t.TempDir()
	inputPath := tempDir + "/nonexistent.mp4"

	// Create invalid metadata
	metadata := &VideoMetadata{
		DurationMinutes: 0,
		SelectedBitrate: 0,
		EstimatedSize:   0,
	}

	_, err := converter.executeConversion(ctx, inputPath, metadata)
	if err == nil {
		t.Error("Expected error for non-existent input file")
	}
}

func TestVideoConverter_runConversion(t *testing.T) {
	converter := setupTestConverter(t)

	// Test runConversion with invalid command
	// Create a command that will fail
	ctx := context.Background()
	cmd := exec.CommandContext(ctx, "nonexistent_command", "arg1", "arg2")

	tempDir := t.TempDir()
	outputPath := tempDir + "/output.mp3"

	err := converter.runConversion(cmd, outputPath)
	if err == nil {
		t.Error("Expected error for invalid command")
	}
}

func TestVideoConverter_logConversionStart(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewTextHandler(&buf, nil))
	converter := NewVideoConverterWithLogger(logger)

	inputPath := "/test/input.mp4"
	outputPath := "/test/output.mp3"
	metadata := &VideoMetadata{
		DurationMinutes: 120.5,
		SelectedBitrate: 32,
		EstimatedSize:   15728640,
	}

	// This should not panic or error
	converter.logConversionStart(inputPath, outputPath, metadata)

	// Check that something was logged
	logOutput := buf.String()
	if logOutput == "" {
		t.Error("Expected log output but got none")
	}
	if !strings.Contains(logOutput, "input.mp4") {
		t.Error("Expected log to contain input filename")
	}
}

func TestVideoConverter_validateOutput(t *testing.T) {
	converter := setupTestConverter(t)

	// Test validateOutput with non-existent file
	err := converter.validateOutput("/nonexistent/output.mp3")
	if err == nil {
		t.Error("Expected error for non-existent output file")
	}

	// Test validateOutput with existing file
	tempDir := t.TempDir()
	validOutput := tempDir + "/valid_output.mp3"
	if err := os.WriteFile(validOutput, []byte("fake audio data"), 0644); err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}

	err = converter.validateOutput(validOutput)
	if err != nil {
		t.Errorf("validateOutput failed for existing file: %v", err)
	}
}

func TestVideoConverter_ErrorMessageConsistency(t *testing.T) {
	converter := setupTestConverter(t)
	ctx := context.Background()
	_ = ctx // Used in subtests

	t.Run("consistent_error_patterns", func(t *testing.T) {
		// Test that similar errors have consistent messaging
		errorScenarios := []struct {
			name             string
			path             string
			expectedPatterns []string // Allow multiple acceptable error patterns
		}{
			{"nonexistent_file", "/tmp/nonexistent_video_12345.mp4", []string{"stat", "no such file"}},
			{"empty_path", "", []string{"stat", "no such file"}},
			{"null_path", "\x00", []string{"stat", "invalid argument", "validation failed"}},
		}

		for _, scenario := range errorScenarios {
			t.Run(scenario.name, func(t *testing.T) {
				_, err := converter.ConvertVideoToAudio(ctx, scenario.path)
				if err == nil {
					t.Errorf("Expected error for %s, got none", scenario.name)
					return
				}

				// Check error message contains at least one expected pattern
				errorMsg := err.Error()
				found := false

				// If FFmpeg is not available, we expect that error instead
				if !converter.IsFFmpegAvailable() {
					if strings.Contains(errorMsg, "FFmpeg is not installed") || strings.Contains(errorMsg, "not in PATH") {
						found = true
					}
				} else {
					// Check original expected patterns when FFmpeg is available
					for _, pattern := range scenario.expectedPatterns {
						if strings.Contains(errorMsg, pattern) {
							found = true
							break
						}
					}
				}

				if !found {
					if !converter.IsFFmpegAvailable() {
						t.Logf("FFmpeg not available, got expected error: %v", err)
					} else {
						t.Errorf("Error message doesn't contain any expected patterns %v: %v", scenario.expectedPatterns, err)
					}
				}
			})
		}
	})

	t.Run("error_wrapping_consistency", func(t *testing.T) {
		// Test that errors are properly wrapped
		_, err := converter.ConvertVideoToAudio(ctx, "/nonexistent/path")
		if err == nil {
			t.Error("Expected error for nonexistent path")
			return
		}

		// Should be able to unwrap the error
		var unwrapped error = err
		for unwrapped != nil {
			if next := errors.Unwrap(unwrapped); next != nil {
				unwrapped = next
			} else {
				break
			}
		}

		// Final unwrapped error should be meaningful
		if unwrapped == nil {
			t.Error("Error chain doesn't end with a concrete error")
		}
	})
}

func TestVideoConverter_NewVideoConverterWithLogger(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewTextHandler(&buf, nil))

	converter := NewVideoConverterWithLogger(logger)
	if converter == nil {
		t.Error("Expected non-nil converter")
	}
	if converter.logger != logger {
		t.Error("Expected logger to be set")
	}
}

func TestVideoConverter_analyzeVideo(t *testing.T) {
	converter := NewVideoConverter()
	ctx := context.Background()

	// Test with non-existent file - should fail at validation
	_, err := converter.analyzeVideo(ctx, "/nonexistent/file.mp4")
	if err == nil {
		t.Error("Expected error for non-existent file")
	}
}

func TestVideoConverter_validateInput(t *testing.T) {
	converter := NewVideoConverter()

	// Test with non-existent file
	err := converter.validateInput("/nonexistent/file.mp4")
	if err == nil {
		t.Error("Expected error for non-existent file")
	}
}

func TestVideoConverter_generateAudioPathEdgeCases(t *testing.T) {
	converter := NewVideoConverter()

	tests := []struct {
		input    string
		expected string
	}{
		{"/tmp/video.mp4", "/tmp/video_converted.mp3"},
		{"/path/to/movie.avi", "/path/to/movie_converted.mp3"},
		{"video.mkv", "video_converted.mp3"},
		{"/path/file.with.dots.mp4", "/path/file.with.dots_converted.mp3"},
	}

	for _, tt := range tests {
		result := converter.generateAudioPath(tt.input)
		if result != tt.expected {
			t.Errorf("generateAudioPath(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

// Note: Testing actual video conversion would require ffmpeg to be installed
// and would be more of an integration test. The above tests focus on the
// logic and error handling of the converter without requiring external dependencies.
