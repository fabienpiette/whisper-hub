package service

import (
	"context"
	"fmt"
	"io"
	"os"

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
		return "", fmt.Errorf("transcription failed: %w", err)
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
		return "", fmt.Errorf("transcription failed: %w", err)
	}

	return resp.Text, nil
}