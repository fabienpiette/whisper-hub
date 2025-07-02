# 📚 Whisper Hub Documentation

Welcome to the comprehensive documentation for Whisper Hub - a privacy-first self-hosted audio and video transcription service.

## 📖 Documentation Overview

### 🚀 Getting Started
- **[Main README](../README.md)** - Project overview, features, and quick start
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete deployment guide with Docker, Compose, and Portainer
- **[DOCKER_HUB_TOKEN_SETUP.md](DOCKER_HUB_TOKEN_SETUP.md)** - Setting up Docker Hub authentication

### 🔧 Development & CI/CD
- **[Main README](../README.md#-development--ci-pipeline)** - Local development with Makefile commands
- **[CLAUDE.md](../CLAUDE.md)** - Development guide with CI commands and architecture
- **[CI_IMPROVEMENTS.md](CI_IMPROVEMENTS.md)** - ✨ **NEW**: Complete CI/CD pipeline improvements and Makefile commands
- **[DOCKER_RELEASE.md](DOCKER_RELEASE.md)** - Complete guide for releasing Docker images
- **[DOCKER_AUTOMATION.md](DOCKER_AUTOMATION.md)** - CI/CD automation setup with GitHub Actions
- **[DOCKER_REGISTRY_MANAGEMENT.md](DOCKER_REGISTRY_MANAGEMENT.md)** - Managing Docker Hub registry
- **[RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)** - Step-by-step release validation

### 📊 Analysis & History
- **[PERFORMANCE_ANALYSIS.md](PERFORMANCE_ANALYSIS.md)** - Performance benchmarks and optimization
- **[PERFORMANCE_REPORT.md](PERFORMANCE_REPORT.md)** - Detailed performance metrics
- **[HISTORY_ARCHITECTURE.md](HISTORY_ARCHITECTURE.md)** - Architecture evolution history
- **[HISTORY_IMPLEMENTATION_COMPLETE.md](HISTORY_IMPLEMENTATION_COMPLETE.md)** - Implementation timeline

## 🎯 Quick Navigation

### For Users
| Task | Documentation |
|------|---------------|
| **Deploy with Docker** | [DEPLOYMENT.md](DEPLOYMENT.md) → Option 1 |
| **Deploy with Portainer** | [DEPLOYMENT.md](DEPLOYMENT.md) → Option 3 |
| **Deploy with Docker Compose** | [DEPLOYMENT.md](DEPLOYMENT.md) → Option 2 |
| **Troubleshoot issues** | [DEPLOYMENT.md](DEPLOYMENT.md) → Troubleshooting |
| **Configure settings** | [DEPLOYMENT.md](DEPLOYMENT.md) → Configuration |

### For Developers
| Task | Documentation |
|------|---------------|
| **Quick setup** | `make setup` → [Main README](../README.md#quick-start) |
| **Local CI pipeline** | `make ci` → [Main README](../README.md#development--ci-pipeline) |
| **Development workflow** | [CLAUDE.md](../CLAUDE.md) → Development Commands |
| **Testing & quality** | `make quick-check` → [Main README](../README.md#development-commands) |
| **CI/CD improvements** | [CI_IMPROVEMENTS.md](CI_IMPROVEMENTS.md) → ✨ **NEW** Makefile & pipeline |
| **Release new version** | [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) |
| **Performance analysis** | [PERFORMANCE_ANALYSIS.md](PERFORMANCE_ANALYSIS.md) |

### For Maintainers
| Task | Documentation |
|------|---------------|
| **Docker Hub releases** | [DOCKER_RELEASE.md](DOCKER_RELEASE.md) |
| **Registry management** | [DOCKER_REGISTRY_MANAGEMENT.md](DOCKER_REGISTRY_MANAGEMENT.md) |
| **CI/CD setup** | [DOCKER_AUTOMATION.md](DOCKER_AUTOMATION.md) |
| **Token configuration** | [DOCKER_HUB_TOKEN_SETUP.md](DOCKER_HUB_TOKEN_SETUP.md) |

## 🏗️ Project Structure

```
whisper-hub/
├── README.md                    # Project overview and quick start
├── CLAUDE.md                    # Development guidance
├── docker-compose.yml          # Docker Compose configuration
├── Dockerfile                  # Docker image build
├── docs/                       # 📚 Documentation (you are here)
│   ├── README.md               # Documentation index
│   ├── DEPLOYMENT.md           # Deployment guide
│   ├── DOCKER_*.md            # Docker-related documentation
│   ├── RELEASE_*.md           # Release management
│   └── *.md                   # Additional documentation
├── scripts/                   # 🔧 Development scripts
│   ├── ci/                    # Continuous integration
│   ├── dev/                   # Development utilities
│   └── qa/                    # Quality assurance
├── cmd/server/                # 🚀 Application entry point
├── internal/                  # 🔒 Internal Go packages
├── web/                       # 🎨 Frontend assets
└── test/                      # 🧪 Test suites
```

## 🐳 Deployment Options

### Quick Start (Recommended)
```bash
# One-command deployment
docker run -d \
  --name whisper-hub \
  -p 8080:8080 \
  -e OPENAI_API_KEY=your-key \
  sighadd/whisper-hub:latest
```

### Docker Compose
```bash
git clone <repo-url>
cd whisper-hub
OPENAI_API_KEY=your-key docker-compose up -d
```

### Portainer Stack
Use the docker-compose.yml from [DEPLOYMENT.md](DEPLOYMENT.md) in Portainer Stacks.

## 🔒 Security Features

- **Enterprise-grade security** with CSRF protection and XSS prevention
- **Privacy-first design** with zero server-side storage
- **Client-side encryption** for history management
- **GDPR/CCPA compliance** with data portability
- **Rate limiting** and DDoS protection
- **Input validation** and file sanitization

## 🎬 Media Processing

- **Intelligent video conversion** with adaptive bitrate
- **Multi-format support**: MP3, WAV, MP4, AVI, MOV, etc.
- **Size optimization** for OpenAI API compliance
- **Real-time progress tracking** with error handling

## 📊 Performance

- **Lightweight**: ~50MB Docker image
- **Efficient**: 50-200MB RAM idle, 300-500MB during transcription
- **Fast**: Optimized video conversion with FFmpeg
- **Reliable**: Comprehensive error handling and recovery

## 🆘 Support

### Documentation Issues
If you find issues with this documentation:
1. Check the specific document for troubleshooting sections
2. Create an issue in the GitHub repository
3. Include relevant logs and configuration details

### Common Resources
- **Health Check**: `curl http://localhost:8080/health`
- **Metrics**: `curl http://localhost:8080/metrics`
- **Logs**: `docker-compose logs -f`
- **Debug**: See [DEPLOYMENT.md](DEPLOYMENT.md) troubleshooting

### Community
- **Issues**: Use GitHub Issues for bug reports
- **Discussions**: Use GitHub Discussions for questions
- **Security**: Follow responsible disclosure for security issues

## 🔄 Updates

This documentation is actively maintained and updated with each release. Last updated: Current with project structure reorganization.

### Contributing to Documentation
- Follow existing documentation style and structure
- Update the relevant index when adding new documents
- Test all commands and configurations before documenting
- Use clear headings and consistent formatting

---

📖 **Navigation**: [Back to Main README](../README.md) | [Deployment Guide](DEPLOYMENT.md) | [Scripts Documentation](../scripts/README.md)