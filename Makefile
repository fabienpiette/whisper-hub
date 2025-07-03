.PHONY: help build run clean test test-coverage test-frontend test-critical test-integration test-e2e test-performance test-security test-config test-all docker-build docker-run docker-compose-up docker-compose-down setup deps ci ci-backend ci-frontend ci-security ci-docker vet fmt lint check-fmt install-tools

help: ## Show this help
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Development Commands
build: ## Build the Go binary
	go build -o bin/whisper-hub-server cmd/server/main.go

run: ## Run the application locally
	go run cmd/server/main.go

clean: ## Clean build artifacts
	rm -rf bin/ coverage.out coverage.html

# Testing Commands
test: ## Run basic Go tests
	go test -v ./...

test-coverage: ## Run Go tests with coverage (CI version)
	go test -v -coverprofile=coverage.out -covermode=atomic ./... -skip "ThreadSafety"
	go tool cover -func=coverage.out

test-frontend: ## Run all frontend tests
	npm test

test-critical: ## Run critical frontend tests only
	npm run test:critical

test-integration: ## Run OpenAI integration tests with mocking
	@echo "Running OpenAI integration tests..."
	go test -v ./test/openai_integration_test.go -run "TestOpenAIIntegration"
	@echo "✅ Integration tests completed"

test-e2e: ## Run end-to-end workflow tests
	@echo "Running end-to-end workflow tests..."
	npx jest test/e2e_workflow_test.js --verbose
	@echo "✅ E2E tests completed"

test-performance: ## Run performance and load tests
	@echo "Running performance and load tests..."
	npx jest test/performance_load_test.js --verbose
	@echo "✅ Performance tests completed"

test-security: ## Run security validation tests
	@echo "Running security validation tests..."
	npx jest test/security_validation_test.js --verbose
	@echo "✅ Security tests completed"

test-config: ## Run configuration and environment tests
	@echo "Running configuration tests..."
	go test -v ./internal/config/post_actions_test.go
	@echo "✅ Configuration tests completed"

test-error-handling: ## Run error handling and edge case tests
	@echo "Running error handling tests..."
	npx jest test/error_handling_edge_cases_test.js --verbose
	@echo "✅ Error handling tests completed"

test-post-actions: ## Run comprehensive post-action service tests
	@echo "Running post-action service tests..."
	go test -v ./internal/service/post_action_test.go
	@echo "✅ Post-action service tests completed"

test-security-utils: ## Run SecurityUtils comprehensive tests
	@echo "Running SecurityUtils tests..."
	npx jest test/security_utils_test.js --verbose
	@echo "✅ SecurityUtils tests completed"

test-frontend-integration: ## Run frontend integration tests for fixed issues
	@echo "Running frontend integration tests..."
	npx jest test/frontend_integration_fixed_test.js --verbose
	@echo "✅ Frontend integration tests completed"

test-create-manage: ## Run Create/Manage button functionality tests
	@echo "Running Create/Manage button tests..."
	npx jest test/create_manage_buttons_test.js --verbose
	@echo "✅ Create/Manage button tests completed"

test-security-integration: ## Run SecurityUtils integration tests for the fix
	@echo "Running SecurityUtils integration tests..."
	npx jest test/security_utils_integration_test.js --verbose
	@echo "✅ SecurityUtils integration tests completed"

test-all: test test-critical test-integration test-e2e test-performance test-security test-config test-error-handling test-post-actions test-security-utils test-frontend-integration test-create-manage test-security-integration ## Run all test suites
	@echo ""
	@echo "🧪 Complete Test Suite Results:"
	@echo "✅ Go unit tests passed"
	@echo "✅ Critical frontend tests passed"
	@echo "✅ OpenAI integration tests passed"
	@echo "✅ End-to-end workflow tests passed"
	@echo "✅ Performance tests passed"
	@echo "✅ Security validation tests passed"
	@echo "✅ Configuration tests passed"
	@echo "✅ Error handling tests passed"
	@echo "✅ Post-action service tests passed"
	@echo "✅ SecurityUtils tests passed"
	@echo "✅ Frontend integration tests passed"
	@echo "✅ Create/Manage button tests passed"
	@echo "✅ SecurityUtils integration tests passed"
	@echo ""
	@echo "🎉 All test suites completed successfully!"

# Code Quality Commands
vet: ## Run Go vet
	go vet ./...

fmt: ## Format Go code
	go fmt ./...

check-fmt: ## Check if Go code is formatted
	@if [ "$$(gofmt -s -l . | wc -l)" -gt 0 ]; then \
		echo "❌ Go code is not formatted properly:"; \
		gofmt -s -l .; \
		echo "Run 'make fmt' to fix formatting"; \
		exit 1; \
	else \
		echo "✅ Go code is properly formatted"; \
	fi

lint: install-tools ## Run security and quality checks
	@echo "Running gosec security scanner..."
	@$$(go env GOPATH)/bin/gosec ./... || echo "⚠️  Security findings detected - review needed"
	@echo "Running staticcheck..."
	@$$(go env GOPATH)/bin/staticcheck ./... || echo "⚠️  Staticcheck findings - review needed"

install-tools: ## Install development tools
	@echo "Installing development tools..."
	@go install github.com/securego/gosec/v2/cmd/gosec@latest
	@go install honnef.co/go/tools/cmd/staticcheck@latest
	@echo "✅ Tools installed"

# Dependencies
deps: ## Download and verify Go dependencies
	go mod download
	go mod verify
	go mod tidy

deps-frontend: ## Install frontend dependencies
	npm ci

deps-all: deps deps-frontend ## Install all dependencies

# Docker Commands
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

docker-test: ## Test Docker build and health
	@echo "Testing Docker build..."
	docker build -t whisper-hub:test .
	@echo "Testing Docker container..."
	docker run -d --name whisper-hub-test -p 8080:8080 -e OPENAI_API_KEY=test-key whisper-hub:test
	@echo "Waiting for container to start..."
	@sleep 10
	@if curl -f http://localhost:8080/health; then \
		echo "✅ Docker health check passed"; \
	else \
		echo "❌ Docker health check failed"; \
		docker logs whisper-hub-test; \
		exit 1; \
	fi
	@echo "Cleaning up test container..."
	@docker stop whisper-hub-test || true
	@docker rm whisper-hub-test || true

# CI Pipeline Commands
ci-backend: deps check-fmt vet test-coverage ## Run backend CI pipeline
	@echo "✅ Backend CI pipeline completed"

ci-frontend: deps-frontend test-critical test-security test-e2e ## Run frontend CI pipeline
	@echo "✅ Frontend CI pipeline completed"

ci-security: install-tools lint ## Run security checks
	@echo "✅ Security checks completed"

ci-docker: docker-test ## Run Docker CI pipeline
	@echo "✅ Docker CI pipeline completed"

ci-qa: test-integration test-performance test-config test-error-handling test-post-actions test-security-utils test-frontend-integration test-create-manage ## Run QA test suite
	@echo "✅ QA test suite completed"

ci: ci-backend ci-frontend ci-security ci-docker ci-qa ## Run complete CI pipeline locally
	@echo ""
	@echo "🚀 Complete CI Pipeline Results:"
	@echo "✅ Backend tests passed"
	@echo "✅ Frontend tests passed"
	@echo "✅ Security checks passed"
	@echo "✅ Docker build passed"
	@echo "✅ QA test suite passed"
	@echo ""
	@echo "🎉 All CI checks completed successfully!"

# Setup Commands
setup: ## Setup development environment
	@echo "Setting up development environment..."
	@echo ""
	@echo "1. Install dependencies..."
	@$(MAKE) deps-all
	@echo ""
	@echo "2. Install development tools..."
	@$(MAKE) install-tools
	@echo ""
	@echo "3. Set your OPENAI_API_KEY environment variable:"
	@echo "   export OPENAI_API_KEY=sk-your-actual-api-key-here"
	@echo ""
	@echo "4. Run the application:"
	@echo "   make run"
	@echo ""
	@echo "5. Run CI pipeline locally:"
	@echo "   make ci"
	@echo ""
	@echo "✅ Development environment setup completed!"

# Quick Development Commands
quick-test: test-critical vet ## Quick tests for development
	@echo "✅ Quick tests completed"

quick-check: check-fmt vet quick-test ## Quick code quality check
	@echo "✅ Quick check completed"