package validation

import (
	"mime/multipart"
	"strings"
	
	"whisper-hub/internal/constants"
	"whisper-hub/internal/errors"
)

// AudioFileValidator handles audio file validation
type AudioFileValidator struct {
	supportedExtensions []string
	maxSize             int64
}

// NewAudioFileValidator creates a new audio file validator
func NewAudioFileValidator(maxSize int64) *AudioFileValidator {
	return &AudioFileValidator{
		supportedExtensions: constants.SupportedAudioExtensions,
		maxSize:             maxSize,
	}
}

// ValidateFile validates an uploaded audio file
func (v *AudioFileValidator) ValidateFile(header *multipart.FileHeader) error {
	if header == nil {
		return errors.NewValidationError("file", "no file provided")
	}
	
	if err := v.validateSize(header.Size); err != nil {
		return err
	}
	
	if err := v.validateExtension(header.Filename); err != nil {
		return err
	}
	
	return nil
}

// ValidateExtension checks if the file extension is supported
func (v *AudioFileValidator) ValidateExtension(filename string) error {
	return v.validateExtension(filename)
}

func (v *AudioFileValidator) validateExtension(filename string) error {
	if filename == "" {
		return errors.NewValidationError("filename", "filename cannot be empty")
	}
	
	filename = strings.ToLower(filename)
	
	for _, ext := range v.supportedExtensions {
		if strings.HasSuffix(filename, ext) {
			return nil
		}
	}
	
	return errors.NewValidationError("file_type", constants.ErrInvalidFileType)
}

func (v *AudioFileValidator) validateSize(size int64) error {
	if size > v.maxSize {
		return errors.NewValidationError("file_size", constants.ErrFileTooLarge)
	}
	
	if size == 0 {
		return errors.NewValidationError("file_size", "file cannot be empty")
	}
	
	return nil
}

// GetSupportedExtensions returns the list of supported audio extensions
func (v *AudioFileValidator) GetSupportedExtensions() []string {
	return v.supportedExtensions
}