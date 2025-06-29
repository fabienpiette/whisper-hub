package service

import (
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"whisper-hub/internal/constants"
	"whisper-hub/internal/errors"
)

// VideoConverter handles video to audio conversion using FFmpeg
type VideoConverter struct {
	ffmpegPath string
	timeout    time.Duration
	logger     *slog.Logger
}

// NewVideoConverter creates a new video converter
func NewVideoConverter() *VideoConverter {
	return &VideoConverter{
		ffmpegPath: "ffmpeg", // Assumes ffmpeg is in PATH
		timeout:    10 * time.Minute, // Increased timeout for large files
		logger:     slog.Default(),
	}
}

// NewVideoConverterWithLogger creates a new video converter with custom logger
func NewVideoConverterWithLogger(logger *slog.Logger) *VideoConverter {
	return &VideoConverter{
		ffmpegPath: "ffmpeg",
		timeout:    10 * time.Minute,
		logger:     logger,
	}
}

// ConvertVideoToAudio converts a video file to audio format
func (c *VideoConverter) ConvertVideoToAudio(ctx context.Context, videoPath string) (string, error) {
	if _, err := os.Stat(videoPath); os.IsNotExist(err) {
		return "", errors.NewFileError("stat", videoPath, err)
	}

	// Check if FFmpeg is available
	if !c.IsFFmpegAvailable() {
		c.logger.Error("ffmpeg not available", "path", c.ffmpegPath)
		return "", errors.NewInternalServerError("FFmpeg is not installed or not in PATH", nil)
	}

	// Create output path with .wav extension
	audioPath := c.generateAudioPath(videoPath)

	// Create context with timeout
	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	// Build FFmpeg command with error capture
	cmd := c.buildFFmpegCommand(ctx, videoPath, audioPath)
	
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	c.logger.Info("starting video conversion", 
		"input", videoPath, 
		"output", audioPath,
		"timeout", c.timeout)

	// Execute conversion
	start := time.Now()
	if err := cmd.Run(); err != nil {
		// Clean up failed conversion
		os.Remove(audioPath)
		
		stderrOutput := stderr.String()
		c.logger.Error("ffmpeg conversion failed", 
			"error", err,
			"stderr", stderrOutput,
			"duration", time.Since(start),
			"exit_code", cmd.ProcessState.ExitCode())
		
		// Return more descriptive error
		if strings.Contains(stderrOutput, "Invalid data found") {
			return "", errors.NewInternalServerError("Video file appears to be corrupted or in unsupported format", err)
		}
		if strings.Contains(stderrOutput, "No such file") {
			return "", errors.NewInternalServerError("Video file not found during conversion", err)
		}
		if strings.Contains(stderrOutput, "Permission denied") {
			return "", errors.NewInternalServerError("Permission denied accessing video file", err)
		}
		if strings.Contains(stderrOutput, "Disk quota exceeded") || strings.Contains(stderrOutput, "No space left") {
			return "", errors.NewInternalServerError("Insufficient disk space for conversion", err)
		}
		
		return "", errors.NewInternalServerError(constants.ErrVideoConversionFailed+": "+stderrOutput, err)
	}

	duration := time.Since(start)
	c.logger.Info("video conversion completed", 
		"input", videoPath, 
		"output", audioPath,
		"duration", duration)

	// Verify output file exists and has content
	if stat, err := os.Stat(audioPath); os.IsNotExist(err) {
		return "", errors.NewFileError("stat", audioPath, err)
	} else if stat.Size() == 0 {
		os.Remove(audioPath)
		return "", errors.NewInternalServerError("Conversion produced empty audio file", nil)
	}

	return audioPath, nil
}

// IsFFmpegAvailable checks if FFmpeg is available on the system
func (c *VideoConverter) IsFFmpegAvailable() bool {
	cmd := exec.Command(c.ffmpegPath, "-version")
	return cmd.Run() == nil
}

// generateAudioPath creates the output audio file path
func (c *VideoConverter) generateAudioPath(videoPath string) string {
	dir := filepath.Dir(videoPath)
	baseName := strings.TrimSuffix(filepath.Base(videoPath), filepath.Ext(videoPath))
	return filepath.Join(dir, baseName+"_converted.wav")
}

// buildFFmpegCommand constructs the FFmpeg command for video to audio conversion
func (c *VideoConverter) buildFFmpegCommand(ctx context.Context, inputPath, outputPath string) *exec.Cmd {
	args := []string{
		"-hide_banner",            // Reduce banner output
		"-loglevel", "error",      // Only show errors
		"-i", inputPath,           // Input file
		"-vn",                     // Disable video recording
		"-acodec", "pcm_s16le",    // Audio codec: 16-bit PCM
		"-ar", "16000",            // Audio sample rate: 16kHz (optimal for Whisper)
		"-ac", "1",                // Audio channels: mono
		"-f", "wav",               // Output format: WAV
		"-avoid_negative_ts", "make_zero", // Handle timestamp issues
		"-fflags", "+genpts",      // Generate presentation timestamps
		"-max_muxing_queue_size", "1024", // Increase queue size for large files
		"-y",                      // Overwrite output file
		outputPath,                // Output file
	}

	cmd := exec.CommandContext(ctx, c.ffmpegPath, args...)
	cmd.Stdout = nil // Suppress stdout
	
	return cmd
}

// GetConversionTimeout returns the conversion timeout duration
func (c *VideoConverter) GetConversionTimeout() time.Duration {
	return c.timeout
}

// SetConversionTimeout sets the conversion timeout duration
func (c *VideoConverter) SetConversionTimeout(timeout time.Duration) {
	c.timeout = timeout
}

// CleanupConvertedFile removes the converted audio file
func (c *VideoConverter) CleanupConvertedFile(audioPath string) error {
	if audioPath == "" {
		return nil
	}
	
	if err := os.Remove(audioPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to cleanup converted audio file: %w", err)
	}
	
	return nil
}