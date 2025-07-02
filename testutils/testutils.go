package testutils

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
)

// CreateMultipartFile creates a multipart form file for testing
func CreateMultipartFile(filename, content string) (*bytes.Buffer, string, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("audio", filename)
	if err != nil {
		return nil, "", err
	}

	_, err = part.Write([]byte(content))
	if err != nil {
		return nil, "", err
	}

	err = writer.Close()
	if err != nil {
		return nil, "", err
	}

	return body, writer.FormDataContentType(), nil
}

// AssertStatusCode checks if the response has the expected status code
func AssertStatusCode(t *testing.T, resp *httptest.ResponseRecorder, expected int) {
	t.Helper()
	if resp.Code != expected {
		t.Errorf("expected status code %d, got %d", expected, resp.Code)
	}
}

// AssertContains checks if the response body contains the expected string
func AssertContains(t *testing.T, resp *httptest.ResponseRecorder, expected string) {
	t.Helper()
	body := resp.Body.String()
	if !bytes.Contains([]byte(body), []byte(expected)) {
		t.Errorf("expected response to contain %q, got %q", expected, body)
	}
}

// AssertNotContains checks if the response body does not contain the string
func AssertNotContains(t *testing.T, resp *httptest.ResponseRecorder, notExpected string) {
	t.Helper()
	body := resp.Body.String()
	if bytes.Contains([]byte(body), []byte(notExpected)) {
		t.Errorf("expected response to not contain %q, got %q", notExpected, body)
	}
}

// AssertContentType checks if the response has the expected content type
func AssertContentType(t *testing.T, resp *httptest.ResponseRecorder, expected string) {
	t.Helper()
	contentType := resp.Header().Get("Content-Type")
	if contentType != expected {
		t.Errorf("expected Content-Type %q, got %q", expected, contentType)
	}
}

// MockFile implements multipart.File for testing
type MockFile struct {
	*bytes.Reader
	closed bool
}

// NewMockFile creates a new mock file with the given content
func NewMockFile(content string) *MockFile {
	return &MockFile{
		Reader: bytes.NewReader([]byte(content)),
		closed: false,
	}
}

// Close implements the Close method for multipart.File
func (m *MockFile) Close() error {
	m.closed = true
	return nil
}

// IsClosed returns whether the file has been closed
func (m *MockFile) IsClosed() bool {
	return m.closed
}

// ErrorReader implements io.Reader and always returns an error
type ErrorReader struct {
	err error
}

// NewErrorReader creates a new ErrorReader that returns the given error
func NewErrorReader(err error) *ErrorReader {
	return &ErrorReader{err: err}
}

// Read always returns the configured error
func (e *ErrorReader) Read(p []byte) (n int, err error) {
	return 0, e.err
}

// Close implements io.Closer
func (e *ErrorReader) Close() error {
	return nil
}

// MockHTTPClient can be used to mock HTTP requests in tests
type MockHTTPClient struct {
	DoFunc func(req *http.Request) (*http.Response, error)
}

// Do executes the mock function
func (m *MockHTTPClient) Do(req *http.Request) (*http.Response, error) {
	return m.DoFunc(req)
}

// CreateMockResponse creates a mock HTTP response
func CreateMockResponse(statusCode int, body string, headers map[string]string) *http.Response {
	resp := &http.Response{
		StatusCode: statusCode,
		Body:       io.NopCloser(bytes.NewReader([]byte(body))),
		Header:     make(http.Header),
	}

	for key, value := range headers {
		resp.Header.Set(key, value)
	}

	return resp
}

// TempDirForTest creates a temporary directory for testing and returns cleanup function
func TempDirForTest(t *testing.T, pattern string) (string, func()) {
	t.Helper()

	tempDir := t.TempDir()
	return tempDir, func() {
		// t.TempDir() automatically cleans up, so this is a no-op
		// but provides a consistent interface
	}
}

// AssertErrorContains checks if an error contains a specific message
func AssertErrorContains(t *testing.T, err error, expected string) {
	t.Helper()
	if err == nil {
		t.Fatalf("expected error containing %q, got nil", expected)
	}
	if !bytes.Contains([]byte(err.Error()), []byte(expected)) {
		t.Errorf("expected error to contain %q, got %q", expected, err.Error())
	}
}

// AssertNoError checks if there is no error
func AssertNoError(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}
