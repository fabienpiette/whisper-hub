package errors

import (
	"errors"
	"net/http"
	"testing"
)

func TestAppError_Error(t *testing.T) {
	tests := []struct {
		name     string
		err      *AppError
		expected string
	}{
		{
			name: "error with underlying error",
			err: &AppError{
				Code:    http.StatusBadRequest,
				Message: "Invalid input",
				Err:     errors.New("validation failed"),
			},
			expected: "Invalid input: validation failed",
		},
		{
			name: "error without underlying error",
			err: &AppError{
				Code:    http.StatusInternalServerError,
				Message: "Server error",
			},
			expected: "Server error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.err.Error()
			if result != tt.expected {
				t.Errorf("Error() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestAppError_Unwrap(t *testing.T) {
	originalErr := errors.New("original error")
	appErr := &AppError{
		Code:    http.StatusBadRequest,
		Message: "Bad request",
		Err:     originalErr,
	}

	unwrapped := appErr.Unwrap()
	if unwrapped != originalErr {
		t.Errorf("Unwrap() = %v, want %v", unwrapped, originalErr)
	}
}

func TestNewBadRequestError(t *testing.T) {
	msg := "Invalid parameter"
	originalErr := errors.New("validation error")
	err := NewBadRequestError(msg, originalErr)

	if err.Code != http.StatusBadRequest {
		t.Errorf("Expected code %d, got %d", http.StatusBadRequest, err.Code)
	}
	if err.Message != msg {
		t.Errorf("Expected message %q, got %q", msg, err.Message)
	}
	if err.Err != originalErr {
		t.Errorf("Expected underlying error %v, got %v", originalErr, err.Err)
	}
}

func TestNewInternalServerError(t *testing.T) {
	msg := "Server error"
	originalErr := errors.New("database connection failed")
	err := NewInternalServerError(msg, originalErr)

	if err.Code != http.StatusInternalServerError {
		t.Errorf("Expected code %d, got %d", http.StatusInternalServerError, err.Code)
	}
	if err.Message != msg {
		t.Errorf("Expected message %q, got %q", msg, err.Message)
	}
	if err.Err != originalErr {
		t.Errorf("Expected underlying error %v, got %v", originalErr, err.Err)
	}
}

func TestNewMethodNotAllowedError(t *testing.T) {
	msg := "Method not allowed"
	err := NewMethodNotAllowedError(msg)

	if err.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected code %d, got %d", http.StatusMethodNotAllowed, err.Code)
	}
	if err.Message != msg {
		t.Errorf("Expected message %q, got %q", msg, err.Message)
	}
}

func TestNewTooManyRequestsError(t *testing.T) {
	msg := "Rate limit exceeded"
	err := NewTooManyRequestsError(msg)

	if err.Code != http.StatusTooManyRequests {
		t.Errorf("Expected code %d, got %d", http.StatusTooManyRequests, err.Code)
	}
	if err.Message != msg {
		t.Errorf("Expected message %q, got %q", msg, err.Message)
	}
}

func TestNewValidationError(t *testing.T) {
	field := "email"
	msg := "invalid format"
	err := NewValidationError(field, msg)

	if err.Code != http.StatusBadRequest {
		t.Errorf("Expected code %d, got %d", http.StatusBadRequest, err.Code)
	}
	expectedMsg := "validation failed for email: invalid format"
	if err.Message != expectedMsg {
		t.Errorf("Expected message %q, got %q", expectedMsg, err.Message)
	}
}

func TestNewFileError(t *testing.T) {
	operation := "read"
	filename := "test.txt"
	originalErr := errors.New("permission denied")
	err := NewFileError(operation, filename, originalErr)

	if err.Code != http.StatusInternalServerError {
		t.Errorf("Expected code %d, got %d", http.StatusInternalServerError, err.Code)
	}
	expectedMsg := "file read failed for test.txt"
	if err.Message != expectedMsg {
		t.Errorf("Expected message %q, got %q", expectedMsg, err.Message)
	}
	if err.Err != originalErr {
		t.Errorf("Expected underlying error %v, got %v", originalErr, err.Err)
	}
}

func TestNewTranscriptionError(t *testing.T) {
	originalErr := errors.New("API error")
	err := NewTranscriptionError(originalErr)

	if err.Code != http.StatusInternalServerError {
		t.Errorf("Expected code %d, got %d", http.StatusInternalServerError, err.Code)
	}
	expectedMsg := "transcription service failed"
	if err.Message != expectedMsg {
		t.Errorf("Expected message %q, got %q", expectedMsg, err.Message)
	}
	if err.Err != originalErr {
		t.Errorf("Expected underlying error %v, got %v", originalErr, err.Err)
	}
}