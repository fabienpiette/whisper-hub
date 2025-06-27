package validation

import (
	"mime/multipart"
	"strings"
	
	"whisper-hub/internal/constants"
	"whisper-hub/internal/errors"
)

// FileType represents the type of file
type FileType int

const (
	FileTypeUnknown FileType = iota
	FileTypeAudio
	FileTypeVideo
)

// FileValidator handles audio and video file validation
type FileValidator struct {
	audioExtensions []string
	videoExtensions []string
	maxSize         int64
}

// NewFileValidator creates a new file validator
func NewFileValidator(maxSize int64) *FileValidator {
	return &FileValidator{
		audioExtensions: constants.SupportedAudioExtensions,
		videoExtensions: constants.SupportedVideoExtensions,
		maxSize:         maxSize,
	}
}

// ValidateFile validates an uploaded file (audio or video)
func (v *FileValidator) ValidateFile(header *multipart.FileHeader) error {
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

// GetFileType determines if the file is audio or video
func (v *FileValidator) GetFileType(filename string) FileType {
	filename = strings.ToLower(filename)
	
	for _, ext := range v.audioExtensions {
		if strings.HasSuffix(filename, ext) {
			return FileTypeAudio
		}
	}
	
	for _, ext := range v.videoExtensions {
		if strings.HasSuffix(filename, ext) {
			return FileTypeVideo
		}
	}
	
	return FileTypeUnknown
}

// IsAudioFile checks if the file is an audio file
func (v *FileValidator) IsAudioFile(filename string) bool {
	return v.GetFileType(filename) == FileTypeAudio
}

// IsVideoFile checks if the file is a video file
func (v *FileValidator) IsVideoFile(filename string) bool {
	return v.GetFileType(filename) == FileTypeVideo
}

func (v *FileValidator) validateExtension(filename string) error {
	if filename == "" {
		return errors.NewValidationError("filename", "filename cannot be empty")
	}
	
	fileType := v.GetFileType(filename)
	if fileType == FileTypeUnknown {
		return errors.NewValidationError("file_type", constants.ErrInvalidFileType)
	}
	
	return nil
}

func (v *FileValidator) validateSize(size int64) error {
	if size > v.maxSize {
		return errors.NewValidationError("file_size", constants.ErrFileTooLarge)
	}
	
	if size == 0 {
		return errors.NewValidationError("file_size", "file cannot be empty")
	}
	
	return nil
}

// GetSupportedExtensions returns all supported extensions (audio + video)
func (v *FileValidator) GetSupportedExtensions() ([]string, []string) {
	return v.audioExtensions, v.videoExtensions
}