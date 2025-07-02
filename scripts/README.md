# Scripts Directory

This directory contains various scripts used for development, CI/CD, and quality assurance.

## Directory Structure

```
scripts/
├── ci/          # Continuous Integration scripts
├── dev/         # Development utility scripts  
├── qa/          # Quality Assurance scripts
└── README.md    # This file
```

## CI Scripts (`scripts/ci/`)

- `pr_title_check.sh` - Validates PR titles follow conventional commit format
- `pr_body_check.sh` - Validates PR descriptions contain required sections

## Development Scripts (`scripts/dev/`)

- `test_script.sh` - Development testing utility

## Quality Assurance Scripts (`scripts/qa/`)

*Scripts for quality assurance and testing will be added here*

## Usage

All scripts should be executable and follow these conventions:

1. **Shebang**: Start with `#!/bin/bash`
2. **Error handling**: Use `set -e` for strict error handling
3. **Documentation**: Include usage comments at the top
4. **Exit codes**: Use appropriate exit codes (0 for success, 1+ for errors)

## Running Scripts

From the project root:

```bash
# CI scripts
./scripts/ci/pr_title_check.sh
./scripts/ci/pr_body_check.sh

# Development scripts  
./scripts/dev/test_script.sh
```

## Adding New Scripts

When adding new scripts:

1. Place them in the appropriate subdirectory
2. Make them executable: `chmod +x script_name.sh`
3. Update this README with a description
4. Follow the naming convention: `kebab-case.sh`