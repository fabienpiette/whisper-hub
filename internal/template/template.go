package template

import (
	"html/template"
	"net/http"
	"path/filepath"
)

// Service handles template rendering
type Service struct {
	templates map[string]*template.Template
}

// NewService creates a new template service
func NewService(templateDir string) (*Service, error) {
	s := &Service{
		templates: make(map[string]*template.Template),
	}
	
	// Load templates
	if err := s.loadTemplates(templateDir); err != nil {
		return nil, err
	}
	
	return s, nil
}

// loadTemplates loads all templates from the template directory
func (s *Service) loadTemplates(templateDir string) error {
	// Load index template
	indexPath := filepath.Join(templateDir, "index.html")
	indexTmpl, err := template.ParseFiles(indexPath)
	if err != nil {
		return err
	}
	s.templates["index"] = indexTmpl
	
	return nil
}

// RenderIndex renders the main index page
func (s *Service) RenderIndex(w http.ResponseWriter, data interface{}) error {
	tmpl, exists := s.templates["index"]
	if !exists {
		http.Error(w, "Template not found", http.StatusInternalServerError)
		return nil
	}
	
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	return tmpl.Execute(w, data)
}

// GetTemplate returns a template by name
func (s *Service) GetTemplate(name string) (*template.Template, bool) {
	tmpl, exists := s.templates[name]
	return tmpl, exists
}