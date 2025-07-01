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
	
	// Bitrate constants (kbps)
	HighQualityBitrate = 64
	MediumQualityBitrate = 32
	LowQualityBitrate = 24
	
	// Duration thresholds (minutes)
	ShortVideoDuration = 60
	MediumVideoDuration = 120
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

	// Pre-validate video file integrity
	if err := c.validateVideoFile(ctx, videoPath); err != nil {
		c.logger.Error("video file validation failed", "error", err, "filename", videoPath)
		return "", err
	}

	// Detect video duration for adaptive bitrate selection
	duration, err := c.getVideoDuration(ctx, videoPath)
	if err != nil {
		c.logger.Warn("failed to detect video duration, using default bitrate", "error", err)
		duration = 0 // Will use default bitrate
	}

	// Create output path with .wav extension
	audioPath := c.generateAudioPath(videoPath)

	// Create context with timeout
	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	// Build FFmpeg command with adaptive bitrate
	cmd := c.buildFFmpegCommand(ctx, videoPath, audioPath, duration)
	
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	selectedBitrate := c.calculateOptimalBitrate(duration)
	estimatedSize := c.estimateAudioFileSize(duration, selectedBitrate)

	c.logger.Info("starting video conversion", 
		"input", videoPath, 
		"output", audioPath,
		"duration_minutes", duration,
		"selected_bitrate", selectedBitrate,
		"estimated_size_mb", estimatedSize/(1024*1024),
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

	conversionDuration := time.Since(start)
	c.logger.Info("video conversion completed", 
		"input", videoPath, 
		"output", audioPath,
		"conversion_duration", conversionDuration)

	// Verify output file exists and has content
	if stat, err := os.Stat(audioPath); os.IsNotExist(err) {
		return "", errors.NewFileError("stat", audioPath, err)
	} else if stat.Size() == 0 {
		os.Remove(audioPath)
		return "", errors.NewInternalServerError("Conversion produced empty audio file", nil)
	} else if stat.Size() > MaxAudioFileSize {
		os.Remove(audioPath)
		return "", errors.NewInternalServerError(
			fmt.Sprintf("Converted audio file is too large (%d MB). OpenAI Whisper has a 25MB limit. Please use a shorter video or compress it further", 
				stat.Size()/(1024*1024)), nil)
	}

	return audioPath, nil
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
	bitrate := c.calculateOptimalBitrate(duration)
	bitrateStr := fmt.Sprintf("%dk", bitrate)
	
	args := []string{
		"-hide_banner",            // Reduce banner output
		"-loglevel", "error",      // Only show errors
		"-i", inputPath,           // Input file
		"-vn",                     // Disable video recording
		"-acodec", "libmp3lame",   // Audio codec: MP3 LAME encoder
		"-ar", "16000",            // Audio sample rate: 16kHz (optimal for Whisper)
		"-ac", "1",                // Audio channels: mono
		"-b:a", bitrateStr,        // Audio bitrate: adaptive based on duration
		"-f", "mp3",               // Output format: MP3
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
	durationMinutes := durationSeconds / 60.0
	return durationMinutes, nil
}

// calculateOptimalBitrate determines the best bitrate based on video duration
func (c *VideoConverter) calculateOptimalBitrate(durationMinutes float64) int {
	if durationMinutes <= 0 {
		// Unknown duration, use default high quality
		return HighQualityBitrate
	}
	
	// Calculate what bitrate would produce target file size (24MB)
	// Formula: size_bytes = (bitrate_kbps * 1024 * duration_seconds) / 8
	// Rearranged: bitrate_kbps = (size_bytes * 8) / (duration_seconds * 1024)
	durationSeconds := durationMinutes * 60
	calculatedBitrate := float64(TargetAudioFileSize*8) / (durationSeconds * 1024)
	
	// Apply practical limits and thresholds
	if durationMinutes <= ShortVideoDuration {
		// Short videos: use high quality if it fits, otherwise calculated
		if calculatedBitrate >= HighQualityBitrate {
			return HighQualityBitrate
		}
		return int(math.Max(calculatedBitrate, LowQualityBitrate))
	} else if durationMinutes <= MediumVideoDuration {
		// Medium videos: prefer medium quality if it fits
		if calculatedBitrate >= MediumQualityBitrate {
			return MediumQualityBitrate
		}
		return int(math.Max(calculatedBitrate, LowQualityBitrate))
	} else {
		// Long videos: use calculated bitrate but ensure minimum quality
		return int(math.Max(calculatedBitrate, LowQualityBitrate))
	}
}

// estimateAudioFileSize estimates the resulting audio file size in bytes
func (c *VideoConverter) estimateAudioFileSize(durationMinutes float64, bitrateKbps int) int64 {
	if durationMinutes <= 0 {
		return 0
	}
	
	// Formula: size_bytes = (bitrate_kbps * 1024 * duration_seconds) / 8
	// Using 1024 instead of 1000 for more accurate binary calculations
	durationSeconds := durationMinutes * 60
	sizeBytes := int64((float64(bitrateKbps) * 1024 * durationSeconds) / 8)
	
	return sizeBytes
}