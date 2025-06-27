.PHONY: help build run docker-build docker-run docker-compose-up docker-compose-down clean test

help: ## Show this help
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

build: ## Build the Go binary
	go build -o bin/whisper-hub-server cmd/server/main.go

run: ## Run the application locally
	go run cmd/server/main.go

test: ## Run tests
	go test -v ./...

clean: ## Clean build artifacts
	rm -rf bin/

docker-build: ## Build Docker image
	docker build -t whisper-hub .

docker-run: ## Run Docker container
	docker run -d --name whisper-hub -p 8080:8080 -e OPENAI_API_KEY=$(OPENAI_API_KEY) whisper-hub

docker-compose-up: ## Start with Docker Compose
	docker-compose up -d

docker-compose-down: ## Stop Docker Compose
	docker-compose down

docker-compose-logs: ## View Docker Compose logs
	docker-compose logs -f

setup: ## Setup development environment
	@echo "Set your OPENAI_API_KEY environment variable:"
	@echo "export OPENAI_API_KEY=sk-your-actual-api-key-here"

deps: ## Install Go dependencies
	go mod tidy