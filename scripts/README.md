# 🔧 Scripts Directory

This directory contains organized scripts for development, CI/CD, and quality assurance following backend architecture principles.

## 📁 Directory Structure

```
scripts/
├── ci/                      # Continuous Integration & Release
│   ├── pr_title_check.sh   # PR title validation
│   ├── pr_body_check.sh    # PR description validation
│   ├── release.sh          # Automated release process
│   ├── validate-release.sh # Pre-release validation
│   └── test-docker-auth.sh # Docker Hub authentication test
├── dev/                     # Development Utilities
│   ├── setup.sh            # Development environment setup
│   ├── test-coverage.sh    # Comprehensive test coverage
│   ├── run-benchmarks.sh   # Performance benchmarks
│   └── test_script.sh      # Development testing utility
├── qa/                      # Quality Assurance
│   └── validate-code-quality.sh # Code quality validation
└── README.md               # This file
```

## 🚀 CI Scripts (`scripts/ci/`)

### Release Management
- **`release.sh`** - Automated release script for Docker Hub
  ```bash
  ./scripts/ci/release.sh v1.2.3
  ```
- **`validate-release.sh`** - Pre-release validation and checks
  ```bash
  ./scripts/ci/validate-release.sh
  ```
- **`test-docker-auth.sh`** - Test Docker Hub authentication
  ```bash
  export DOCKER_HUB_TOKEN=your_token
  ./scripts/ci/test-docker-auth.sh
  ```

### Pull Request Validation
- **`pr_title_check.sh`** - Validates PR titles follow conventional commit format
- **`pr_body_check.sh`** - Validates PR descriptions contain required sections

## 🛠️ Development Scripts (`scripts/dev/`)

### Environment Setup
- **`setup.sh`** - Complete development environment setup
  ```bash
  ./scripts/dev/setup.sh
  ```
  - Installs Go dependencies
  - Sets up git hooks  
  - Creates necessary directories
  - Validates tools (FFmpeg, Node.js)

### Testing & Coverage
- **`test-coverage.sh`** - Comprehensive test coverage analysis
  ```bash
  ./scripts/dev/test-coverage.sh
  ```
  - Runs all tests with coverage
  - Generates HTML coverage reports
  - Shows uncovered code sections
  - Validates coverage thresholds

- **`run-benchmarks.sh`** - Performance benchmarking
  ```bash
  ./scripts/dev/run-benchmarks.sh
  ```
  - Runs Go benchmarks
  - Measures performance metrics
  - Compares with previous results

### Legacy
- **`test_script.sh`** - Development testing utility (legacy)

## 🔍 Quality Assurance Scripts (`scripts/qa/`)

- **`validate-code-quality.sh`** - Comprehensive code quality validation
  ```bash
  ./scripts/qa/validate-code-quality.sh
  ```
  - Checks cyclomatic complexity
  - Finds TODO/FIXME comments
  - Validates error handling patterns
  - Analyzes code structure

## 🎯 Common Workflows

### Development Setup (New Contributors)
```bash
# Complete development environment setup
./scripts/dev/setup.sh

# Run quality checks
./scripts/qa/validate-code-quality.sh

# Run tests with coverage
./scripts/dev/test-coverage.sh
```

### Pre-Release Workflow (Maintainers)
```bash
# Validate release readiness
./scripts/ci/validate-release.sh

# Create and push release
./scripts/ci/release.sh v1.2.3
```

### Testing & Quality Assurance
```bash
# Run all quality checks
./scripts/qa/validate-code-quality.sh

# Generate coverage report
./scripts/dev/test-coverage.sh

# Run performance benchmarks
./scripts/dev/run-benchmarks.sh
```

## 📋 Script Conventions

All scripts follow these standards:

1. **Shebang**: Start with `#!/bin/bash`
2. **Error handling**: Use `set -e` for strict error handling
3. **Documentation**: Include usage comments at the top
4. **Exit codes**: Use appropriate exit codes (0 for success, 1+ for errors)
5. **Logging**: Use consistent output formatting with colors
6. **Validation**: Check prerequisites before execution

## 🚀 Running Scripts

### From Project Root
```bash
# CI scripts
./scripts/ci/release.sh v1.2.3
./scripts/ci/validate-release.sh
./scripts/ci/test-docker-auth.sh

# Development scripts
./scripts/dev/setup.sh
./scripts/dev/test-coverage.sh
./scripts/dev/run-benchmarks.sh

# Quality assurance
./scripts/qa/validate-code-quality.sh
```

### GitHub Actions Integration
Scripts are integrated with GitHub Actions workflows:
- **PR validation**: `pr_title_check.sh`, `pr_body_check.sh`
- **Release automation**: `release.sh`, `validate-release.sh`
- **Testing**: Coverage and quality checks in CI

## 🔧 Adding New Scripts

When adding new scripts:

1. **Choose appropriate directory**:
   - `ci/` for release and CI/CD scripts
   - `dev/` for development utilities
   - `qa/` for quality assurance tools

2. **Follow naming convention**: `kebab-case.sh`

3. **Make executable**: `chmod +x script_name.sh`

4. **Update documentation**:
   - Add to this README
   - Include usage examples
   - Document any dependencies

5. **Test thoroughly**:
   - Test on clean environment
   - Verify error handling
   - Check exit codes

## 🛡️ Security Considerations

- Scripts handle sensitive data (Docker tokens) safely
- Environment variables are validated before use
- No secrets are logged or stored in files
- Temporary files are cleaned up automatically

## 📊 Performance & Monitoring

Scripts include:
- **Progress indicators** for long-running operations
- **Resource usage monitoring** during execution
- **Performance metrics** collection and reporting
- **Error tracking** with detailed diagnostics

## 🆘 Troubleshooting

### Common Issues

**Permission denied**:
```bash
chmod +x scripts/path/to/script.sh
```

**Docker authentication fails**:
```bash
# Check token setup
./scripts/ci/test-docker-auth.sh
```

**Coverage reports not generated**:
```bash
# Ensure Go tools are installed
./scripts/dev/setup.sh
```

### Getting Help

- Check individual script comments for usage
- See [docs/](../docs/) for comprehensive guides
- Create GitHub issues for script bugs
- Review GitHub Actions logs for CI failures

---

🔗 **Related Documentation**: [Main README](../README.md) | [Development Guide](../docs/README.md) | [Release Process](../docs/DOCKER_RELEASE.md)