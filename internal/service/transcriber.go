package service

import (
	"context"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/sashabaranov/go-openai"
)

type Transcriber struct {
	client *openai.Client
}

func NewTranscriber(apiKey string) *Transcriber {
	return &Transcriber{
		client: openai.NewClient(apiKey),
	}
}

func (t *Transcriber) TranscribeFile(ctx context.Context, filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	req := openai.AudioRequest{
		Model:    openai.Whisper1,
		FilePath: filePath,
		Reader:   file,
	}

	resp, err := t.client.CreateTranscription(ctx, req)
	if err != nil {
		return "", t.formatTranscriptionError(err)
	}

	return resp.Text, nil
}

func (t *Transcriber) TranscribeReader(ctx context.Context, reader io.Reader, filename string) (string, error) {
	req := openai.AudioRequest{
		Model:    openai.Whisper1,
		FilePath: filename,
		Reader:   reader,
	}

	resp, err := t.client.CreateTranscription(ctx, req)
	if err != nil {
		return "", t.formatTranscriptionError(err)
	}

	return resp.Text, nil
}

// formatTranscriptionError provides user-friendly error messages for OpenAI transcription failures
func (t *Transcriber) formatTranscriptionError(err error) error {
	errStr := err.Error()
	
	// Check for specific OpenAI error types and provide user-friendly messages
	if strings.Contains(errStr, "401") || strings.Contains(errStr, "unauthorized") || strings.Contains(errStr, "invalid_api_key") {
		return fmt.Errorf("API key invalid or expired. Please check your OpenAI API configuration")
	}
	
	if strings.Contains(errStr, "429") || strings.Contains(errStr, "rate_limit") || strings.Contains(errStr, "quota") {
		return fmt.Errorf("OpenAI API rate limit exceeded or quota reached. Please try again later")
	}
	
	if strings.Contains(errStr, "400") || strings.Contains(errStr, "invalid_request") {
		if strings.Contains(errStr, "file") {
			return fmt.Errorf("Audio file format not supported by OpenAI. Try converting to MP3, WAV, or M4A")
		}
		return fmt.Errorf("Invalid request to OpenAI API. The audio file may be corrupted or too large")
	}
	
	if strings.Contains(errStr, "413") || strings.Contains(errStr, "file_too_large") {
		return fmt.Errorf("Audio file is too large for OpenAI Whisper (max 25MB). Please compress or trim the file")
	}
	
	if strings.Contains(errStr, "422") || strings.Contains(errStr, "unsupported_file") {
		return fmt.Errorf("Audio file format not supported. Please use MP3, MP4, WAV, M4A, or other common formats")
	}
	
	if strings.Contains(errStr, "500") || strings.Contains(errStr, "internal_server_error") {
		return fmt.Errorf("OpenAI service temporarily unavailable. Please try again in a few minutes")
	}
	
	if strings.Contains(errStr, "503") || strings.Contains(errStr, "service_unavailable") {
		return fmt.Errorf("OpenAI Whisper service is currently overloaded. Please try again later")
	}
	
	if strings.Contains(errStr, "timeout") || strings.Contains(errStr, "context deadline exceeded") {
		return fmt.Errorf("Transcription timed out. The audio file may be too long or the service is slow")
	}
	
	if strings.Contains(errStr, "network") || strings.Contains(errStr, "connection") {
		return fmt.Errorf("Network connection failed. Please check your internet connection and try again")
	}
	
	// Return the original error with a helpful prefix for unknown errors
	return fmt.Errorf("Transcription failed: %s", errStr)
}