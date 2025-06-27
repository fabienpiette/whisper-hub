package handler

import (
	"context"
	"log/slog"
	"mime/multipart"
	"net/http"
	"time"

	"whisper-hub/internal/config"
	"whisper-hub/internal/constants"
	"whisper-hub/internal/errors"
	"whisper-hub/internal/interfaces"
	"whisper-hub/internal/response"
	"whisper-hub/internal/service"
	"whisper-hub/internal/storage"
	"whisper-hub/internal/validation"
)

type TranscribeHandler struct {
	transcriber     *service.Transcriber
	videoConverter  *service.VideoConverter
	tempManager     *storage.TempFileManager
	validator       *validation.FileValidator
	responseWriter  *response.Writer
	templateService interfaces.TemplateService
	config          *config.Config
	logger          *slog.Logger
}

func NewTranscribeHandler(cfg *config.Config, logger *slog.Logger, templateService interfaces.TemplateService) *TranscribeHandler {
	return &TranscribeHandler{
		transcriber:     service.NewTranscriber(cfg.OpenAIAPIKey),
		videoConverter:  service.NewVideoConverter(),
		tempManager:     storage.NewTempFileManager(cfg.TempDir),
		validator:       validation.NewFileValidator(cfg.UploadMaxSize),
		responseWriter:  response.NewWriter(),
		templateService: templateService,
		config:          cfg,
		logger:          logger,
	}
}

func (h *TranscribeHandler) HandleIndex(w http.ResponseWriter, r *http.Request) {
	if err := h.templateService.RenderIndex(w, nil); err != nil {
		h.logger.Error("failed to render index template", "error", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}
}

func (h *TranscribeHandler) HandleTranscribe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, constants.ErrMethodNotAllowed, http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set(constants.HeaderContentType, constants.ContentTypeHTML)

	// Parse and validate form
	file, header, err := h.parseAndValidateForm(r)
	if err != nil {
		h.responseWriter.WriteError(w, err)
		return
	}
	defer file.Close()

	h.logger.Info("processing transcription request", 
		"filename", header.Filename, 
		"size", header.Size,
	)

	h.responseWriter.WriteLoading(w)

	// Save and process file
	transcription, err := h.processTranscription(file, header)
	if err != nil {
		h.responseWriter.WriteError(w, err)
		return
	}

	h.responseWriter.WriteTranscriptionResult(w, transcription, header.Filename)
}

// parseAndValidateForm handles form parsing and validation
func (h *TranscribeHandler) parseAndValidateForm(r *http.Request) (file multipart.File, header *multipart.FileHeader, err error) {
	err = r.ParseMultipartForm(h.config.UploadMaxSize)
	if err != nil {
		h.logger.Error("failed to parse multipart form", "error", err, "max_size", h.config.UploadMaxSize)
		return nil, nil, &errors.AppError{Code: http.StatusBadRequest, Message: constants.ErrFileTooLarge, Err: err}
	}

	// Try to get file from either 'audio' or 'file' field for backward compatibility
	file, header, err = r.FormFile(constants.FormFieldAudio)
	if err != nil {
		// Try alternative field name
		file, header, err = r.FormFile(constants.FormFieldFile)
		if err != nil {
			h.logger.Warn("no file in request", "error", err)
			return nil, nil, &errors.AppError{Code: http.StatusBadRequest, Message: constants.ErrNoAudioFile, Err: err}
		}
	}

	if err := h.validator.ValidateFile(header); err != nil {
		h.logger.Warn("file validation failed", "filename", header.Filename, "error", err)
		return nil, nil, err
	}

	return file, header, nil
}

// processTranscription handles file saving, conversion (if needed), and transcription
func (h *TranscribeHandler) processTranscription(file multipart.File, header *multipart.FileHeader) (string, error) {
	filePath, err := h.tempManager.SaveUploadedFile(file, header)
	if err != nil {
		h.logger.Error("failed to save uploaded file", "error", err, "filename", header.Filename)
		return "", &errors.AppError{Code: http.StatusInternalServerError, Message: constants.ErrSaveFileFailed, Err: err}
	}
	defer h.tempManager.Cleanup(filePath)

	// Determine file type and handle conversion if needed
	audioFilePath := filePath
	var convertedAudioPath string
	
	if h.validator.IsVideoFile(header.Filename) {
		h.logger.Info("video file detected, converting to audio", "filename", header.Filename)
		
		ctx, cancel := context.WithTimeout(context.Background(), h.videoConverter.GetConversionTimeout())
		defer cancel()
		
		convertedPath, err := h.videoConverter.ConvertVideoToAudio(ctx, filePath)
		if err != nil {
			h.logger.Error("video conversion failed", "error", err, "filename", header.Filename)
			return "", &errors.AppError{Code: http.StatusInternalServerError, Message: constants.ErrVideoConversionFailed, Err: err}
		}
		
		audioFilePath = convertedPath
		convertedAudioPath = convertedPath
		defer h.videoConverter.CleanupConvertedFile(convertedAudioPath)
		
		h.logger.Info("video conversion completed", "filename", header.Filename, "audio_path", convertedPath)
	}

	ctx, cancel := context.WithTimeout(context.Background(), constants.TranscriptionTimeout)
	defer cancel()

	start := time.Now()
	transcription, err := h.transcriber.TranscribeFile(ctx, audioFilePath)
	duration := time.Since(start)
	
	if err != nil {
		h.logger.Error("transcription failed", 
			"error", err, 
			"filename", header.Filename,
			"duration_ms", duration.Milliseconds(),
		)
		return "", &errors.AppError{Code: http.StatusInternalServerError, Message: constants.ErrTranscribeFailed, Err: err}
	}

	h.logger.Info("transcription completed successfully", 
		"filename", header.Filename,
		"duration_ms", duration.Milliseconds(),
		"transcript_length", len(transcription),
		"was_video", h.validator.IsVideoFile(header.Filename),
	)

	return transcription, nil
}



func (h *TranscribeHandler) HandleHealth(w http.ResponseWriter, r *http.Request) {
	health := map[string]interface{}{
		"status":    constants.HealthyStatus,
		"service":   constants.ServiceName,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"version":   constants.ServiceVersion,
	}
	
	h.responseWriter.WriteJSON(w, http.StatusOK, health)
}

func (h *TranscribeHandler) HandleMetrics(metrics interface{}) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if m, ok := metrics.(interface{ GetStats() map[string]interface{} }); ok {
			stats := m.GetStats()
			stats["timestamp"] = time.Now().UTC().Format(time.RFC3339)
			h.responseWriter.WriteJSON(w, http.StatusOK, stats)
		} else {
			errorData := map[string]interface{}{"error": constants.ErrMetricsUnavailable}
			h.responseWriter.WriteJSON(w, http.StatusInternalServerError, errorData)
		}
	}
}