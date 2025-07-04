package service

import (
	"context"
	"errors"
	"io"
	"strings"
	"testing"
)

func TestNewTranscriber(t *testing.T) {
	tests := []struct {
		name   string
		apiKey string
	}{
		{
			name:   "valid api key",
			apiKey: "sk-test-key",
		},
		{
			name:   "empty api key",
			apiKey: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			transcriber := NewTranscriber(tt.apiKey)
			if transcriber == nil {
				t.Error("NewTranscriber returned nil")
			}
			if transcriber.client == nil {
				t.Error("client not initialized")
			}
		})
	}
}

func TestTranscriber_GetClient(t *testing.T) {
	transcriber := NewTranscriber("test-key")
	client := transcriber.GetClient()
	
	if client == nil {
		t.Error("GetClient() should return non-nil client")
	}
}

func TestTranscriber_TranscribeFile(t *testing.T) {
	transcriber := NewTranscriber("test-key")

	tests := []struct {
		name     string
		filePath string
		wantErr  bool
	}{
		{
			name:     "non-existent file",
			filePath: "/path/that/does/not/exist.mp3",
			wantErr:  true,
		},
		{
			name:     "empty file path",
			filePath: "",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			_, err := transcriber.TranscribeFile(ctx, tt.filePath)

			if (err != nil) != tt.wantErr {
				t.Errorf("TranscribeFile() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestTranscriber_TranscribeReader(t *testing.T) {
	transcriber := NewTranscriber("test-key")

	tests := []struct {
		name     string
		reader   io.Reader
		filename string
		wantErr  bool
	}{
		{
			name:     "valid reader",
			reader:   strings.NewReader("test audio data"),
			filename: "test.mp3",
			wantErr:  true, // Will fail due to invalid API key/mock data
		},
		{
			name:     "nil reader",
			reader:   nil,
			filename: "test.mp3",
			wantErr:  true,
		},
		{
			name:     "empty filename",
			reader:   strings.NewReader("test data"),
			filename: "",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			_, err := transcriber.TranscribeReader(ctx, tt.reader, tt.filename)

			if (err != nil) != tt.wantErr {
				t.Errorf("TranscribeReader() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestTranscriber_ContextCancellation(t *testing.T) {
	transcriber := NewTranscriber("test-key")

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	_, err := transcriber.TranscribeReader(ctx, strings.NewReader("test"), "test.mp3")
	if err == nil {
		t.Error("expected error due to cancelled context")
	}

	if !errors.Is(err, context.Canceled) && !strings.Contains(err.Error(), "context") {
		t.Errorf("expected context cancellation error, got: %v", err)
	}
}
