package template

import (
	"html/template"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestNewService(t *testing.T) {
	// Create a temporary directory for templates
	tmpDir := t.TempDir()
	
	// Create a simple index.html template
	indexPath := filepath.Join(tmpDir, "index.html")
	indexContent := `<!DOCTYPE html>
<html>
<head>
    <title>Test Template</title>
</head>
<body>
    <h1>Hello {{.Name}}</h1>
</body>
</html>`
	
	err := os.WriteFile(indexPath, []byte(indexContent), 0644)
	if err != nil {
		t.Fatalf("Failed to create test template: %v", err)
	}
	
	// Test successful service creation
	service, err := NewService(tmpDir)
	if err != nil {
		t.Fatalf("NewService() failed: %v", err)
	}
	
	if service == nil {
		t.Error("NewService() returned nil service")
	}
	
	if service.templates == nil {
		t.Error("Service templates map is nil")
	}
}

func TestNewService_TemplateNotFound(t *testing.T) {
	// Test with non-existent directory
	service, err := NewService("/nonexistent/path")
	if err == nil {
		t.Error("NewService() should have failed with non-existent template directory")
	}
	
	if service != nil {
		t.Error("NewService() should return nil service on error")
	}
}

func TestNewService_InvalidTemplate(t *testing.T) {
	// Create a temporary directory for templates
	tmpDir := t.TempDir()
	
	// Create an invalid template file
	indexPath := filepath.Join(tmpDir, "index.html")
	invalidContent := `<!DOCTYPE html>
<html>
<head>
    <title>Invalid Template</title>
</head>
<body>
    <h1>{{.InvalidSyntax</h1>
</body>
</html>`
	
	err := os.WriteFile(indexPath, []byte(invalidContent), 0644)
	if err != nil {
		t.Fatalf("Failed to create test template: %v", err)
	}
	
	// Test that invalid template causes error
	service, err := NewService(tmpDir)
	if err == nil {
		t.Error("NewService() should have failed with invalid template")
	}
	
	if service != nil {
		t.Error("NewService() should return nil service on template error")
	}
}

func TestService_LoadTemplates(t *testing.T) {
	// Create a temporary directory for templates
	tmpDir := t.TempDir()
	
	// Create a simple index.html template
	indexPath := filepath.Join(tmpDir, "index.html")
	indexContent := `<!DOCTYPE html>
<html>
<head>
    <title>Test Template</title>
</head>
<body>
    <h1>Hello {{.Name}}</h1>
</body>
</html>`
	
	err := os.WriteFile(indexPath, []byte(indexContent), 0644)
	if err != nil {
		t.Fatalf("Failed to create test template: %v", err)
	}
	
	service := &Service{
		templates: make(map[string]*template.Template),
	}
	
	// Test successful template loading
	err = service.loadTemplates(tmpDir)
	if err != nil {
		t.Fatalf("loadTemplates() failed: %v", err)
	}
	
	// Check that index template was loaded
	if _, exists := service.templates["index"]; !exists {
		t.Error("Index template was not loaded")
	}
}

func TestService_LoadTemplates_NonExistentDir(t *testing.T) {
	service := &Service{
		templates: make(map[string]*template.Template),
	}
	
	// Test with non-existent directory
	err := service.loadTemplates("/nonexistent/path")
	if err == nil {
		t.Error("loadTemplates() should have failed with non-existent directory")
	}
}

func TestService_RenderIndex(t *testing.T) {
	// Create a temporary directory for templates
	tmpDir := t.TempDir()
	
	// Create a simple index.html template
	indexPath := filepath.Join(tmpDir, "index.html")
	indexContent := `<!DOCTYPE html>
<html>
<head>
    <title>Test Template</title>
</head>
<body>
    <h1>Hello {{.Name}}</h1>
    <p>Welcome to {{.AppName}}</p>
</body>
</html>`
	
	err := os.WriteFile(indexPath, []byte(indexContent), 0644)
	if err != nil {
		t.Fatalf("Failed to create test template: %v", err)
	}
	
	service, err := NewService(tmpDir)
	if err != nil {
		t.Fatalf("Failed to create service: %v", err)
	}
	
	// Test successful rendering
	w := httptest.NewRecorder()
	data := map[string]interface{}{
		"Name":    "World",
		"AppName": "Test App",
	}
	
	err = service.RenderIndex(w, data)
	if err != nil {
		t.Fatalf("RenderIndex() failed: %v", err)
	}
	
	// Check response
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
	
	body := w.Body.String()
	if !strings.Contains(body, "Hello World") {
		t.Error("Template data not rendered correctly")
	}
	
	if !strings.Contains(body, "Welcome to Test App") {
		t.Error("Template data not rendered correctly")
	}
	
	// Check content type
	contentType := w.Header().Get("Content-Type")
	if contentType != "text/html; charset=utf-8" {
		t.Errorf("Expected content type 'text/html; charset=utf-8', got '%s'", contentType)
	}
}

func TestService_RenderIndex_TemplateNotFound(t *testing.T) {
	service := &Service{
		templates: make(map[string]*template.Template),
	}
	
	// Test with empty templates map
	w := httptest.NewRecorder()
	data := map[string]interface{}{
		"Name": "World",
	}
	
	err := service.RenderIndex(w, data)
	if err != nil {
		t.Errorf("RenderIndex() should not return error for missing template: %v", err)
	}
	
	// Check that it returns 500 error
	if w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 500, got %d", w.Code)
	}
	
	body := w.Body.String()
	if !strings.Contains(body, "Template not found") {
		t.Error("Expected 'Template not found' error message")
	}
}

func TestService_RenderIndex_TemplateExecutionError(t *testing.T) {
	// Create a temporary directory for templates
	tmpDir := t.TempDir()
	
	// Create a template that will cause execution error
	indexPath := filepath.Join(tmpDir, "index.html")
	indexContent := `<!DOCTYPE html>
<html>
<head>
    <title>Test Template</title>
</head>
<body>
    <h1>Hello {{.Name.NonExistentField}}</h1>
</body>
</html>`
	
	err := os.WriteFile(indexPath, []byte(indexContent), 0644)
	if err != nil {
		t.Fatalf("Failed to create test template: %v", err)
	}
	
	service, err := NewService(tmpDir)
	if err != nil {
		t.Fatalf("Failed to create service: %v", err)
	}
	
	// Test with data that will cause execution error
	w := httptest.NewRecorder()
	data := map[string]interface{}{
		"Name": "World", // String doesn't have NonExistentField
	}
	
	err = service.RenderIndex(w, data)
	if err == nil {
		t.Error("RenderIndex() should have failed with template execution error")
	}
}

func TestService_GetTemplate(t *testing.T) {
	// Create a temporary directory for templates
	tmpDir := t.TempDir()
	
	// Create a simple index.html template
	indexPath := filepath.Join(tmpDir, "index.html")
	indexContent := `<!DOCTYPE html>
<html>
<head>
    <title>Test Template</title>
</head>
<body>
    <h1>Hello {{.Name}}</h1>
</body>
</html>`
	
	err := os.WriteFile(indexPath, []byte(indexContent), 0644)
	if err != nil {
		t.Fatalf("Failed to create test template: %v", err)
	}
	
	service, err := NewService(tmpDir)
	if err != nil {
		t.Fatalf("Failed to create service: %v", err)
	}
	
	// Test getting existing template
	tmpl, exists := service.GetTemplate("index")
	if !exists {
		t.Error("GetTemplate() should return true for existing template")
	}
	
	if tmpl == nil {
		t.Error("GetTemplate() should return template for existing template")
	}
	
	// Test getting non-existent template
	tmpl, exists = service.GetTemplate("nonexistent")
	if exists {
		t.Error("GetTemplate() should return false for non-existent template")
	}
	
	if tmpl != nil {
		t.Error("GetTemplate() should return nil for non-existent template")
	}
}

func TestService_GetTemplate_EmptyName(t *testing.T) {
	// Create a temporary directory for templates
	tmpDir := t.TempDir()
	
	// Create a simple index.html template
	indexPath := filepath.Join(tmpDir, "index.html")
	indexContent := `<!DOCTYPE html><html><body><h1>Test</h1></body></html>`
	
	err := os.WriteFile(indexPath, []byte(indexContent), 0644)
	if err != nil {
		t.Fatalf("Failed to create test template: %v", err)
	}
	
	service, err := NewService(tmpDir)
	if err != nil {
		t.Fatalf("Failed to create service: %v", err)
	}
	
	// Test getting template with empty name
	tmpl, exists := service.GetTemplate("")
	if exists {
		t.Error("GetTemplate() should return false for empty name")
	}
	
	if tmpl != nil {
		t.Error("GetTemplate() should return nil for empty name")
	}
}

func TestService_Integration(t *testing.T) {
	// Create a temporary directory for templates
	tmpDir := t.TempDir()
	
	// Create a comprehensive index.html template
	indexPath := filepath.Join(tmpDir, "index.html")
	indexContent := `<!DOCTYPE html>
<html>
<head>
    <title>{{.Title}}</title>
</head>
<body>
    <h1>{{.Heading}}</h1>
    <p>{{.Description}}</p>
    {{if .ShowFeatures}}
    <ul>
        {{range .Features}}
        <li>{{.}}</li>
        {{end}}
    </ul>
    {{end}}
</body>
</html>`
	
	err := os.WriteFile(indexPath, []byte(indexContent), 0644)
	if err != nil {
		t.Fatalf("Failed to create test template: %v", err)
	}
	
	// Create service
	service, err := NewService(tmpDir)
	if err != nil {
		t.Fatalf("Failed to create service: %v", err)
	}
	
	// Test comprehensive rendering
	w := httptest.NewRecorder()
	data := map[string]interface{}{
		"Title":        "Test Application",
		"Heading":      "Welcome to Test App",
		"Description":  "This is a test application",
		"ShowFeatures": true,
		"Features":     []string{"Feature 1", "Feature 2", "Feature 3"},
	}
	
	err = service.RenderIndex(w, data)
	if err != nil {
		t.Fatalf("RenderIndex() failed: %v", err)
	}
	
	// Check response
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
	
	body := w.Body.String()
	expectedContent := []string{
		"Test Application",
		"Welcome to Test App",
		"This is a test application",
		"Feature 1",
		"Feature 2",
		"Feature 3",
	}
	
	for _, content := range expectedContent {
		if !strings.Contains(body, content) {
			t.Errorf("Expected content '%s' not found in response", content)
		}
	}
}