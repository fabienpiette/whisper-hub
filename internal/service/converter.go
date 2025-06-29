package service

import (
	"context"
	"fmt"
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
}

// NewVideoConverter creates a new video converter
func NewVideoConverter() *VideoConverter {
	return &VideoConverter{
		ffmpegPath: "ffmpeg", // Assumes ffmpeg is in PATH
		timeout:    5 * time.Minute,
	}
}

// ConvertVideoToAudio converts a video file to audio format
func (c *VideoConverter) ConvertVideoToAudio(ctx context.Context, videoPath string) (string, error) {
	if _, err := os.Stat(videoPath); os.IsNotExist(err) {
		return "", errors.NewFileError("stat", videoPath, err)
	}

	// Create output path with .wav extension
	audioPath := c.generateAudioPath(videoPath)

	// Create context with timeout
	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	// Build FFmpeg command
	cmd := c.buildFFmpegCommand(ctx, videoPath, audioPath)

	// Execute conversion
	if err := cmd.Run(); err != nil {
		// Clean up failed conversion
		os.Remove(audioPath)
		return "", errors.NewInternalServerError(constants.ErrVideoConversionFailed, err)
	}

	// Verify output file exists
	if _, err := os.Stat(audioPath); os.IsNotExist(err) {
		return "", errors.NewFileError("stat", audioPath, err)
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
		"-i", inputPath,           // Input file
		"-vn",                     // Disable video recording
		"-acodec", "pcm_s16le",    // Audio codec: 16-bit PCM
		"-ar", "16000",            // Audio sample rate: 16kHz (optimal for Whisper)
		"-ac", "1",                // Audio channels: mono
		"-f", "wav",               // Output format: WAV
		"-y",                      // Overwrite output file
		outputPath,                // Output file
	}

	cmd := exec.CommandContext(ctx, c.ffmpegPath, args...)
	
	// Suppress FFmpeg output
	cmd.Stdout = nil
	cmd.Stderr = nil
	
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