package errors

import (
	"fmt"
	"net/http"
)

// AppError represents an application-specific error with HTTP status code
type AppError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Err     error  `json:"-"`
}

func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.Err)
	}
	return e.Message
}

func (e *AppError) Unwrap() error {
	return e.Err
}

// Common error constructors
func NewBadRequestError(message string, err error) *AppError {
	return &AppError{
		Code:    http.StatusBadRequest,
		Message: message,
		Err:     err,
	}
}

func NewInternalServerError(message string, err error) *AppError {
	return &AppError{
		Code:    http.StatusInternalServerError,
		Message: message,
		Err:     err,
	}
}

func NewMethodNotAllowedError(message string) *AppError {
	return &AppError{
		Code:    http.StatusMethodNotAllowed,
		Message: message,
	}
}

func NewTooManyRequestsError(message string) *AppError {
	return &AppError{
		Code:    http.StatusTooManyRequests,
		Message: message,
	}
}

// Validation errors
func NewValidationError(field, message string) *AppError {
	return NewBadRequestError(fmt.Sprintf("validation failed for %s: %s", field, message), nil)
}

// File operation errors
func NewFileError(operation, filename string, err error) *AppError {
	return NewInternalServerError(fmt.Sprintf("file %s failed for %s", operation, filename), err)
}

// Service errors
func NewTranscriptionError(err error) *AppError {
	return NewInternalServerError("transcription service failed", err)
}

func NewUploadError(err error) *AppError {
	return NewBadRequestError("file upload failed", err)
}
