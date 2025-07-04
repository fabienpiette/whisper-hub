package handler

import (
	"context"
	"fmt"
	"log/slog"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"whisper-hub/internal/config"
	"whisper-hub/internal/constants"
	"whisper-hub/internal/errors"
	"whisper-hub/internal/interfaces"
	"whisper-hub/internal/middleware"
	"whisper-hub/internal/response"
	"whisper-hub/internal/service"
	"whisper-hub/internal/storage"
	"whisper-hub/internal/validation"

	"github.com/google/uuid"
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
	metrics         interfaces.MetricsTracker
	security        *middleware.SecurityMiddleware
	postActionService *service.PostActionService
}

func NewTranscribeHandler(cfg *config.Config, logger *slog.Logger, templateService interfaces.TemplateService, metrics interfaces.MetricsTracker) *TranscribeHandler {
	transcriber := service.NewTranscriber(cfg.OpenAIAPIKey)
	var postActionService *service.PostActionService
	
	// Create post-action service with OpenAI client if enabled and API key is available
	if cfg.PostActionsEnabled && cfg.OpenAIAPIKey != "" {
		postActionService = service.NewPostActionService(logger, transcriber.GetClient())
	} else {
		postActionService = service.NewPostActionService(logger, nil)
	}
	
	return &TranscribeHandler{
		transcriber:       transcriber,
		videoConverter:    service.NewVideoConverterWithLogger(logger),
		tempManager:       storage.NewTempFileManager(cfg.TempDir),
		validator:         validation.NewFileValidator(constants.MaxAudioFileSize),
		responseWriter:    response.NewWriter(),
		templateService:   templateService,
		config:            cfg,
		logger:            logger,
		metrics:           metrics,
		security:          middleware.NewSecurityMiddleware(),
		postActionService: postActionService,
	}
}

func (h *TranscribeHandler) HandleIndex(w http.ResponseWriter, r *http.Request) {
	data := map[string]interface{}{
		"CSRFToken": h.security.GetCSRFToken(r),
	}

	if err := h.templateService.RenderIndex(w, data); err != nil {
		h.logger.Error("failed to render index template", "error", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}
}

// HandleCSRFToken provides CSRF tokens for AJAX requests
func (h *TranscribeHandler) HandleCSRFToken(w http.ResponseWriter, r *http.Request) {
	token := h.security.GetCSRFToken(r)

	response := map[string]interface{}{
		"csrf_token": token,
	}

	h.responseWriter.WriteJSON(w, http.StatusOK, response)
}

func (h *TranscribeHandler) HandleTranscribe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, constants.ErrMethodNotAllowed, http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set(constants.HeaderContentType, constants.ContentTypeHTML)

	// Parse and validate form
	file, header, postActionID, err := h.parseAndValidateForm(r)
	if err != nil {
		h.responseWriter.WriteError(w, err)
		return
	}
	defer file.Close()

	h.logger.Info("processing transcription request",
		"filename", header.Filename,
		"size", header.Size,
		"post_action", postActionID,
	)

	// Save and process file
	transcription, processingTime, err := h.processTranscription(file, header)
	if err != nil {
		h.responseWriter.WriteError(w, err)
		return
	}

	// Process custom action if specified
	var actionResult *service.ActionResult
	if postActionID != "" {
		actionResult = h.processCustomAction(postActionID, transcription, header, processingTime)
	}

	// Create history metadata for client-side storage
	metadata := &response.HistoryMetadata{
		ID:        uuid.New().String(),
		Timestamp: time.Now().UTC(),
		FileType:  h.getFileType(header.Filename),
		FileSize:  header.Size,
		Duration:  h.calculateDuration(processingTime, len(transcription)),
	}
	
	// Write result with action result if available
	if actionResult != nil {
		h.responseWriter.WriteTranscriptionResultWithAction(w, transcription, header.Filename, metadata, actionResult)
	} else if h.config.HistoryEnabled {
		h.responseWriter.WriteTranscriptionResultWithMetadata(w, transcription, header.Filename, metadata)
	} else {
		h.responseWriter.WriteTranscriptionResult(w, transcription, header.Filename)
	}
}

// parseAndValidateForm handles form parsing and validation
func (h *TranscribeHandler) parseAndValidateForm(r *http.Request) (file multipart.File, header *multipart.FileHeader, postActionID string, err error) {
	err = r.ParseMultipartForm(h.config.UploadMaxSize)
	if err != nil {
		h.logger.Error("failed to parse multipart form", "error", err, "max_size", h.config.UploadMaxSize)
		return nil, nil, "", &errors.AppError{Code: http.StatusBadRequest, Message: constants.ErrFileTooLarge, Err: err}
	}

	// Extract post action ID if provided
	postActionID = r.FormValue(constants.FormFieldPostAction)

	// Try to get file from either 'audio' or 'file' field for backward compatibility
	file, header, err = r.FormFile(constants.FormFieldAudio)
	if err != nil {
		// Try alternative field name
		file, header, err = r.FormFile(constants.FormFieldFile)
		if err != nil {
			h.logger.Warn("no file in request", "error", err)
			return nil, nil, "", &errors.AppError{Code: http.StatusBadRequest, Message: constants.ErrNoAudioFile, Err: err}
		}
	}

	if err := h.validator.ValidateFile(header); err != nil {
		h.logger.Warn("file validation failed", "filename", header.Filename, "error", err)
		return nil, nil, "", err
	}

	return file, header, postActionID, nil
}

// processTranscription handles file saving, conversion (if needed), and transcription
func (h *TranscribeHandler) processTranscription(file multipart.File, header *multipart.FileHeader) (string, time.Duration, error) {
	filePath, err := h.tempManager.SaveUploadedFile(file, header)
	if err != nil {
		h.logger.Error("failed to save uploaded file", "error", err, "filename", header.Filename)
		return "", 0, &errors.AppError{Code: http.StatusInternalServerError, Message: constants.ErrSaveFileFailed, Err: err}
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
			return "", 0, &errors.AppError{Code: http.StatusInternalServerError, Message: constants.ErrVideoConversionFailed, Err: err}
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
		return "", duration, &errors.AppError{Code: http.StatusInternalServerError, Message: constants.ErrTranscribeFailed, Err: err}
	}

	h.logger.Info("transcription completed successfully",
		"filename", header.Filename,
		"duration_ms", duration.Milliseconds(),
		"transcript_length", len(transcription),
		"was_video", h.validator.IsVideoFile(header.Filename),
	)

	return transcription, duration, nil
}

// processCustomAction handles processing of custom post-transcription actions
func (h *TranscribeHandler) processCustomAction(actionID, transcription string, header *multipart.FileHeader, processingTime time.Duration) *service.ActionResult {
	h.logger.Info("processing custom action", "action_id", actionID, "filename", header.Filename)
	
	// Create action context
	context := &service.ActionContext{
		Transcript:     transcription,
		Filename:       header.Filename,
		Date:           time.Now().Format("2006-01-02"),
		FileType:       h.getFileType(header.Filename),
		Duration:       h.formatProcessingTime(processingTime),
		WordCount:      len(strings.Fields(transcription)),
		CharCount:      len(transcription),
		ProcessingTime: h.formatProcessingTime(processingTime),
	}
	
	// Try to find predefined action first
	action := h.findPredefinedAction(actionID)
	if action == nil {
		h.logger.Warn("action not found", "action_id", actionID)
		return &service.ActionResult{
			Success:     false,
			Error:       "Action not found",
			ActionName:  actionID,
			ProcessedAt: time.Now(),
		}
	}
	
	// Process the action using the PostActionService
	result := h.postActionService.ProcessAction(action, context)
	
	h.logger.Info("custom action processed",
		"action_id", actionID,
		"success", result.Success,
		"output_length", len(result.Output),
		"action_type", result.ActionType,
	)
	
	return result
}

// findPredefinedAction looks up a predefined action by ID
func (h *TranscribeHandler) findPredefinedAction(actionID string) *service.CustomAction {
	predefinedActions := h.postActionService.GetPredefinedActions()
	
	for _, action := range predefinedActions {
		if action.ID == actionID {
			return &action
		}
	}
	
	return nil
}

func (h *TranscribeHandler) formatProcessingTime(duration time.Duration) string {
	if duration < time.Second {
		return fmt.Sprintf("%.0fms", float64(duration.Nanoseconds())/1e6)
	}
	return fmt.Sprintf("%.1fs", duration.Seconds())
}

// getFileType determines if the file is audio or video
func (h *TranscribeHandler) getFileType(filename string) string {
	if h.validator.IsVideoFile(filename) {
		return "video"
	}
	return "audio"
}

// calculateDuration provides an estimated duration based on processing time
// This is a rough estimate since we don't have actual audio duration
func (h *TranscribeHandler) calculateDuration(processingTime time.Duration, transcriptLength int) *float64 {
	// Rough estimation: ~150 words per minute, ~5 chars per word
	if transcriptLength > 0 {
		estimatedMinutes := float64(transcriptLength) / (150 * 5)
		estimatedSeconds := estimatedMinutes * 60
		return &estimatedSeconds
	}
	return nil
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
