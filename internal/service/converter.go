package service

import (
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"whisper-hub/internal/constants"
	"whisper-hub/internal/errors"
)

const (
	// OpenAI Whisper API file size limit (25MB)
	MaxAudioFileSize = 25 * 1024 * 1024 // 26214400 bytes

	// Safe target size (24MB to leave margin)
	TargetAudioFileSize = 24 * 1024 * 1024

	// Calculation constants
	BitsPerByte      = 8
	BytesPerKilobyte = 1024
	SecondsPerMinute = 60

	// Bitrate constants (kbps)
	HighQualityBitrate   = 64
	MediumQualityBitrate = 32
	LowQualityBitrate    = 24

	// Duration thresholds (minutes)
	ShortVideoDuration  = 60
	MediumVideoDuration = 120
)

// BitrateStrategy defines how to calculate optimal bitrate based on duration
type BitrateStrategy interface {
	CalculateBitrate(durationMinutes float64) int
	EstimateFileSize(durationMinutes float64, bitrateKbps int) int64
}

// AdaptiveBitrateStrategy implements intelligent bitrate selection
type AdaptiveBitrateStrategy struct {
	shortThreshold  float64
	mediumThreshold float64
	highBitrate     int
	mediumBitrate   int
	lowBitrate      int
	targetSize      int64
}

// NewAdaptiveBitrateStrategy creates a new adaptive bitrate strategy
func NewAdaptiveBitrateStrategy() *AdaptiveBitrateStrategy {
	return &AdaptiveBitrateStrategy{
		shortThreshold:  ShortVideoDuration,
		mediumThreshold: MediumVideoDuration,
		highBitrate:     HighQualityBitrate,
		mediumBitrate:   MediumQualityBitrate,
		lowBitrate:      LowQualityBitrate,
		targetSize:      TargetAudioFileSize,
	}
}

// CalculateBitrate determines optimal bitrate based on video duration
func (s *AdaptiveBitrateStrategy) CalculateBitrate(durationMinutes float64) int {
	if durationMinutes <= 0 {
		return s.highBitrate
	}

	// Calculate what bitrate would produce target file size
	durationSeconds := durationMinutes * SecondsPerMinute
	calculatedBitrate := float64(s.targetSize*BitsPerByte) / (durationSeconds * BytesPerKilobyte)

	// Apply thresholds and limits
	if durationMinutes <= s.shortThreshold {
		if calculatedBitrate >= float64(s.highBitrate) {
			return s.highBitrate
		}
		return int(math.Max(calculatedBitrate, float64(s.lowBitrate)))
	} else if durationMinutes <= s.mediumThreshold {
		if calculatedBitrate >= float64(s.mediumBitrate) {
			return s.mediumBitrate
		}
		return int(math.Max(calculatedBitrate, float64(s.lowBitrate)))
	} else {
		return int(math.Max(calculatedBitrate, float64(s.lowBitrate)))
	}
}

// EstimateFileSize estimates resulting audio file size in bytes
func (s *AdaptiveBitrateStrategy) EstimateFileSize(durationMinutes float64, bitrateKbps int) int64 {
	if durationMinutes <= 0 {
		return 0
	}

	durationSeconds := durationMinutes * SecondsPerMinute
	sizeBytes := int64((float64(bitrateKbps) * BytesPerKilobyte * durationSeconds) / BitsPerByte)
	return sizeBytes
}

// VideoMetadata contains video analysis results
type VideoMetadata struct {
	DurationMinutes float64
	SelectedBitrate int
	EstimatedSize   int64
}

// VideoConverter handles video to audio conversion using FFmpeg
type VideoConverter struct {
	ffmpegPath      string
	timeout         time.Duration
	logger          *slog.Logger
	bitrateStrategy BitrateStrategy
}

// NewVideoConverter creates a new video converter
func NewVideoConverter() *VideoConverter {
	return &VideoConverter{
		ffmpegPath:      "ffmpeg",         // Assumes ffmpeg is in PATH
		timeout:         10 * time.Minute, // Increased timeout for large files
		logger:          slog.Default(),
		bitrateStrategy: NewAdaptiveBitrateStrategy(),
	}
}

// NewVideoConverterWithLogger creates a new video converter with custom logger
func NewVideoConverterWithLogger(logger *slog.Logger) *VideoConverter {
	return &VideoConverter{
		ffmpegPath:      "ffmpeg",
		timeout:         10 * time.Minute,
		logger:          logger,
		bitrateStrategy: NewAdaptiveBitrateStrategy(),
	}
}

// NewVideoConverterWithStrategy creates a converter with custom bitrate strategy
func NewVideoConverterWithStrategy(strategy BitrateStrategy) *VideoConverter {
	return &VideoConverter{
		ffmpegPath:      "ffmpeg",
		timeout:         10 * time.Minute,
		logger:          slog.Default(),
		bitrateStrategy: strategy,
	}
}

// ConvertVideoToAudio converts a video file to audio format
func (c *VideoConverter) ConvertVideoToAudio(ctx context.Context, videoPath string) (string, error) {
	if err := c.validateInput(videoPath); err != nil {
		return "", err
	}

	metadata, err := c.analyzeVideo(ctx, videoPath)
	if err != nil {
		return "", err
	}

	return c.executeConversion(ctx, videoPath, metadata)
}

// validateInput performs initial validation checks
func (c *VideoConverter) validateInput(videoPath string) error {
	if _, err := os.Stat(videoPath); os.IsNotExist(err) {
		return c.wrapError("stat", videoPath, err)
	}

	if !c.IsFFmpegAvailable() {
		c.logger.Error("ffmpeg not available", "path", c.ffmpegPath)
		return c.newInternalError("FFmpeg is not installed or not in PATH", nil)
	}

	return nil
}

// analyzeVideo performs video analysis and calculates optimal settings
func (c *VideoConverter) analyzeVideo(ctx context.Context, videoPath string) (*VideoMetadata, error) {
	if err := c.validateVideoFile(ctx, videoPath); err != nil {
		c.logger.Error("video file validation failed", "error", err, "filename", videoPath)
		return nil, err
	}

	duration, err := c.getVideoDuration(ctx, videoPath)
	if err != nil {
		c.logger.Warn("failed to detect video duration, using default bitrate", "error", err)
		duration = 0
	}

	bitrate := c.bitrateStrategy.CalculateBitrate(duration)
	estimatedSize := c.bitrateStrategy.EstimateFileSize(duration, bitrate)

	return &VideoMetadata{
		DurationMinutes: duration,
		SelectedBitrate: bitrate,
		EstimatedSize:   estimatedSize,
	}, nil
}

// executeConversion performs the actual video conversion
func (c *VideoConverter) executeConversion(ctx context.Context, videoPath string, metadata *VideoMetadata) (string, error) {
	audioPath := c.generateAudioPath(videoPath)

	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	cmd := c.buildFFmpegCommand(ctx, videoPath, audioPath, metadata.DurationMinutes)

	c.logConversionStart(videoPath, audioPath, metadata)

	if err := c.runConversion(cmd, audioPath); err != nil {
		return "", err
	}

	if err := c.validateOutput(audioPath); err != nil {
		return "", err
	}

	return audioPath, nil
}

// logConversionStart logs conversion parameters
func (c *VideoConverter) logConversionStart(videoPath, audioPath string, metadata *VideoMetadata) {
	c.logger.Info("starting video conversion",
		"input", videoPath,
		"output", audioPath,
		"duration_minutes", metadata.DurationMinutes,
		"selected_bitrate", metadata.SelectedBitrate,
		"estimated_size_mb", metadata.EstimatedSize/(BytesPerKilobyte*BytesPerKilobyte),
		"timeout", c.timeout)
}

// runConversion executes FFmpeg command and handles errors
func (c *VideoConverter) runConversion(cmd *exec.Cmd, audioPath string) error {
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	start := time.Now()
	if err := cmd.Run(); err != nil {
		os.Remove(audioPath) // Clean up failed conversion

		stderrOutput := stderr.String()
		c.logger.Error("ffmpeg conversion failed",
			"error", err,
			"stderr", stderrOutput,
			"duration", time.Since(start),
			"exit_code", cmd.ProcessState.ExitCode())

		return c.categorizeConversionError(stderrOutput, err)
	}

	c.logger.Info("video conversion completed",
		"output", audioPath,
		"conversion_duration", time.Since(start))

	return nil
}

// validateOutput checks converted file meets requirements
func (c *VideoConverter) validateOutput(audioPath string) error {
	stat, err := os.Stat(audioPath)
	if os.IsNotExist(err) {
		return c.wrapError("stat", audioPath, err)
	}

	if stat.Size() == 0 {
		os.Remove(audioPath)
		return c.newInternalError("Conversion produced empty audio file", nil)
	}

	if stat.Size() > MaxAudioFileSize {
		os.Remove(audioPath)
		return c.newInternalError(
			fmt.Sprintf("Converted audio file is too large (%d MB). OpenAI Whisper has a 25MB limit. Please use a shorter video or compress it further",
				stat.Size()/(BytesPerKilobyte*BytesPerKilobyte)), nil)
	}

	return nil
}

// IsFFmpegAvailable checks if FFmpeg is available on the system
func (c *VideoConverter) IsFFmpegAvailable() bool {
	cmd := exec.Command(c.ffmpegPath, "-version")
	return cmd.Run() == nil
}

// validateVideoFile checks if the video file is readable by FFmpeg
func (c *VideoConverter) validateVideoFile(ctx context.Context, videoPath string) error {
	// Create a quick probe command to check file integrity
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, c.ffmpegPath,
		"-hide_banner",
		"-loglevel", "error",
		"-i", videoPath,
		"-t", "1", // Only probe first second
		"-f", "null",
		"-")

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		stderrOutput := stderr.String()

		// Check for specific corruption indicators
		if strings.Contains(stderrOutput, "moov atom not found") {
			return errors.NewInternalServerError("Video file is corrupted or incomplete (missing moov atom)", err)
		}
		if strings.Contains(stderrOutput, "Invalid data found") {
			return errors.NewInternalServerError("Video file contains invalid data or unsupported format", err)
		}
		if strings.Contains(stderrOutput, "No such file") {
			return errors.NewFileError("open", videoPath, err)
		}

		// Generic validation failure
		return errors.NewInternalServerError("Video file validation failed: "+stderrOutput, err)
	}

	return nil
}

// generateAudioPath creates the output audio file path
func (c *VideoConverter) generateAudioPath(videoPath string) string {
	dir := filepath.Dir(videoPath)
	baseName := strings.TrimSuffix(filepath.Base(videoPath), filepath.Ext(videoPath))
	return filepath.Join(dir, baseName+"_converted.mp3")
}

// buildFFmpegCommand constructs the FFmpeg command for video to audio conversion with adaptive bitrate
func (c *VideoConverter) buildFFmpegCommand(ctx context.Context, inputPath, outputPath string, duration float64) *exec.Cmd {
	bitrate := c.bitrateStrategy.CalculateBitrate(duration)
	bitrateStr := fmt.Sprintf("%dk", bitrate)

	args := []string{
		"-hide_banner",       // Reduce banner output
		"-loglevel", "error", // Only show errors
		"-i", inputPath, // Input file
		"-vn",                   // Disable video recording
		"-acodec", "libmp3lame", // Audio codec: MP3 LAME encoder
		"-ar", "16000", // Audio sample rate: 16kHz (optimal for Whisper)
		"-ac", "1", // Audio channels: mono
		"-b:a", bitrateStr, // Audio bitrate: adaptive based on duration
		"-f", "mp3", // Output format: MP3
		"-avoid_negative_ts", "make_zero", // Handle timestamp issues
		"-fflags", "+genpts", // Generate presentation timestamps
		"-max_muxing_queue_size", "1024", // Increase queue size for large files
		"-y",       // Overwrite output file
		outputPath, // Output file
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

// Error handling helpers for consistent error creation

// wrapError creates a consistent file error
func (c *VideoConverter) wrapError(operation, path string, err error) error {
	return errors.NewFileError(operation, path, err)
}

// newInternalError creates a consistent internal error
func (c *VideoConverter) newInternalError(message string, err error) error {
	return errors.NewInternalServerError(message, err)
}

// categorizeConversionError analyzes FFmpeg stderr and returns appropriate error
func (c *VideoConverter) categorizeConversionError(stderrOutput string, originalErr error) error {
	if strings.Contains(stderrOutput, "Invalid data found") {
		return c.newInternalError("Video file appears to be corrupted or in unsupported format", originalErr)
	}
	if strings.Contains(stderrOutput, "No such file") {
		return c.newInternalError("Video file not found during conversion", originalErr)
	}
	if strings.Contains(stderrOutput, "Permission denied") {
		return c.newInternalError("Permission denied accessing video file", originalErr)
	}
	if strings.Contains(stderrOutput, "Disk quota exceeded") || strings.Contains(stderrOutput, "No space left") {
		return c.newInternalError("Insufficient disk space for conversion", originalErr)
	}

	return c.newInternalError(constants.ErrVideoConversionFailed+": "+stderrOutput, originalErr)
}

// getVideoDuration extracts video duration in minutes using ffprobe
func (c *VideoConverter) getVideoDuration(ctx context.Context, videoPath string) (float64, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "ffprobe",
		"-v", "quiet",
		"-show_entries", "format=duration",
		"-of", "csv=p=0",
		videoPath)

	var stdout bytes.Buffer
	cmd.Stdout = &stdout

	if err := cmd.Run(); err != nil {
		return 0, fmt.Errorf("failed to get video duration: %w", err)
	}

	durationStr := strings.TrimSpace(stdout.String())
	durationSeconds, err := strconv.ParseFloat(durationStr, 64)
	if err != nil {
		return 0, fmt.Errorf("failed to parse duration '%s': %w", durationStr, err)
	}

	// Convert seconds to minutes
	durationMinutes := durationSeconds / SecondsPerMinute
	return durationMinutes, nil
}
