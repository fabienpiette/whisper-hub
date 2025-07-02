# Docker Release Checklist

Complete checklist for releasing new versions of Whisper Hub to Docker Hub.

## Pre-Release Checklist

### 🔍 Quality Assurance
- [ ] All tests pass (`go test ./...`)
- [ ] Security validation complete (`./scripts/qa/validate-code-quality.sh`)
- [ ] Docker image builds successfully
- [ ] FFmpeg functionality verified
- [ ] Health endpoint responds correctly
- [ ] Image size under 100MB
- [ ] No security vulnerabilities (high/critical)
- [ ] Performance benchmarks meet standards

### 📋 Documentation
- [ ] README.md updated with new features
- [ ] CHANGELOG.md updated with version changes
- [ ] API changes documented (if any)
- [ ] Breaking changes clearly marked
- [ ] Migration guide provided (if needed)

### 🔧 Environment
- [ ] Git working directory clean
- [ ] On correct branch (main for stable release)
- [ ] Docker Hub authentication configured
- [ ] Required secrets set in CI/CD
- [ ] Multi-platform build environment ready

### 🏷️ Version Planning
- [ ] Version number follows semantic versioning
- [ ] Release type determined (major/minor/patch)
- [ ] Breaking changes justified for major versions
- [ ] Changelog categorizes changes correctly

## Release Process

### 1. Pre-Release Validation
```bash
# Run comprehensive validation
./scripts/ci/validate-release.sh

# Expected output: "✅ All validation checks completed successfully"
```

### 2. Version Tagging
```bash
# Choose version (example: v1.2.3)
VERSION="v1.2.3"

# Run automated release script
./scripts/ci/release.sh $VERSION
```

### 3. Monitor CI/CD Pipeline
- [ ] GitHub Actions workflow triggered
- [ ] Docker build succeeds for all platforms
- [ ] Image tests pass
- [ ] Docker Hub push succeeds
- [ ] GitHub release created

### 4. Post-Release Verification
```bash
# Test released image
docker pull sighadd/whisper-hub:1.2.3
docker run --rm sighadd/whisper-hub:1.2.3 ffmpeg -version

# Test functionality
docker run -d --name test-release \
  -p 8080:8080 \
  -e OPENAI_API_KEY=test \
  sighadd/whisper-hub:1.2.3

# Check health
curl http://localhost:8080/health

# Cleanup
docker stop test-release && docker rm test-release
```

## Release Types

### 🚀 Major Release (v1.0.0 → v2.0.0)
**Use when:** Breaking changes, major architecture changes, API changes

**Additional Steps:**
- [ ] Migration guide created
- [ ] Backwards compatibility breaking changes documented
- [ ] Major announcement prepared
- [ ] Support plan for previous major version
- [ ] Extended testing period
- [ ] Beta/RC releases considered

**Checklist:**
- [ ] Breaking changes clearly documented
- [ ] Migration path provided
- [ ] Previous version support timeline defined
- [ ] Major version announcement ready

### 🌟 Minor Release (v1.1.0 → v1.2.0)
**Use when:** New features, enhancements, new supported formats

**Additional Steps:**
- [ ] New features documented
- [ ] Examples updated
- [ ] Feature compatibility verified
- [ ] Performance impact assessed

**Checklist:**
- [ ] New features tested thoroughly
- [ ] Backwards compatibility maintained
- [ ] Documentation updated for new features
- [ ] Examples demonstrate new capabilities

### 🔧 Patch Release (v1.1.1 → v1.1.2)
**Use when:** Bug fixes, security patches, minor improvements

**Additional Steps:**
- [ ] Bug fixes verified
- [ ] Regression testing completed
- [ ] Security patches validated

**Checklist:**
- [ ] Specific bugs fixed and tested
- [ ] No new features introduced
- [ ] Backwards compatibility maintained
- [ ] Hotfix process followed if urgent

## Emergency Release Process

### 🚨 Critical Security Vulnerability
**Timeline:** Within 24 hours

**Process:**
1. **Immediate Assessment (0-2 hours)**
   ```bash
   # Assess vulnerability severity
   # Determine affected versions
   # Plan patch strategy
   ```

2. **Hotfix Development (2-12 hours)**
   ```bash
   # Create emergency branch
   git checkout -b hotfix/security-$(date +%Y%m%d)
   
   # Apply security fixes
   # Run security scans
   # Validate fix
   ```

3. **Emergency Release (12-24 hours)**
   ```bash
   # Emergency release process
   ./scripts/ci/release.sh v1.2.4
   
   # Immediate communication
   # Update security advisories
   ```

**Checklist:**
- [ ] Security vulnerability assessed and confirmed
- [ ] Patch developed and tested
- [ ] Security scan shows vulnerability resolved
- [ ] Emergency release created
- [ ] Users notified immediately
- [ ] Security advisory published

### 🔥 Critical Bug Fix
**Timeline:** Within 72 hours

**Process:**
1. **Bug Confirmation (0-4 hours)**
2. **Fix Development (4-24 hours)**
3. **Testing and Release (24-72 hours)**

**Checklist:**
- [ ] Bug impact assessed
- [ ] Reproduction steps confirmed
- [ ] Fix implemented and tested
- [ ] Regression testing completed
- [ ] Hotfix release created

## Post-Release Activities

### 📈 Monitoring (First 24 hours)
- [ ] Docker Hub download metrics reviewed
- [ ] GitHub Actions logs checked for issues
- [ ] Community feedback monitored
- [ ] Error reports tracked
- [ ] Performance metrics baseline established

### 📢 Communication
- [ ] Release announced (if major/minor)
- [ ] Social media updates (if significant)
- [ ] Community notifications sent
- [ ] Documentation links updated
- [ ] Dependent projects notified

### 📋 Follow-up (First week)
- [ ] User feedback collected and reviewed
- [ ] Issues prioritized and triaged
- [ ] Next release planning updated
- [ ] Lessons learned documented
- [ ] Process improvements identified

## Rollback Procedures

### 🔄 Emergency Rollback
**When:** Critical issues discovered post-release

**Process:**
```bash
# Identify last known good version
LAST_GOOD="v1.2.2"

# Re-tag latest to point to last good version
docker pull sighadd/whisper-hub:$LAST_GOOD
docker tag sighadd/whisper-hub:$LAST_GOOD sighadd/whisper-hub:latest
docker push sighadd/whisper-hub:latest

# Communicate rollback
echo "🔄 Emergency rollback to $LAST_GOOD due to critical issue"
```

**Checklist:**
- [ ] Rollback reason documented
- [ ] Users notified of rollback
- [ ] Issue being addressed
- [ ] Timeline for fix provided
- [ ] Rollback verified successful

### 📝 Partial Rollback
**When:** Specific tag needs removal

**Process:**
- Remove problematic tag via Docker Hub interface
- Update documentation to reflect removed version
- Communicate version discontinuation

## Quality Gates

### 🚦 Automated Gates
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Security scans pass
- [ ] Performance benchmarks meet thresholds
- [ ] Docker build succeeds
- [ ] Multi-platform support verified

### 👥 Manual Gates
- [ ] Code review completed
- [ ] Documentation review completed
- [ ] Release notes approved
- [ ] Breaking changes approved (if major)
- [ ] Security review completed (if applicable)

## Success Criteria

### ✅ Release Considered Successful When:
- [ ] Docker image available on all target platforms
- [ ] Health checks pass
- [ ] No critical issues reported within 24 hours
- [ ] Download metrics show normal adoption
- [ ] Community feedback is positive
- [ ] All documented features work as expected

### 📊 Metrics to Track:
- Download count within first 24 hours
- Issue reports within first week
- Platform distribution (amd64/arm64/arm/v7)
- Performance compared to previous version
- User feedback sentiment

## Contacts and Resources

### 🆘 Emergency Contacts
- **Docker Hub Support:** https://hub.docker.com/support/
- **GitHub Support:** https://support.github.com/
- **Security Issues:** security@your-domain.com

### 📚 Resources
- **Docker Hub Repository:** https://hub.docker.com/repository/docker/sighadd/whisper-hub
- **GitHub Actions:** https://github.com/fabienpiette/whisper-hub/actions
- **Release Documentation:** docs/DOCKER_RELEASE.md
- **Security Guidelines:** docs/SECURITY.md

### 🔧 Tools Required
- Docker with buildx support
- Git with repository access
- GitHub CLI (optional but recommended)
- curl for testing endpoints
- Access to Docker Hub repository

## Templates

### 📝 Release Announcement Template
```markdown
# Whisper Hub v1.2.3 Released 🎉

We're excited to announce the release of Whisper Hub v1.2.3!

## 🆕 What's New
- [List new features]
- [List improvements]
- [List bug fixes]

## 🚀 Quick Start
```bash
docker run -d \
  --name whisper-hub \
  -p 8080:8080 \
  -e OPENAI_API_KEY=your-key \
  sighadd/whisper-hub:1.2.3
```

## 📋 Supported Platforms
- linux/amd64, linux/arm64, linux/arm/v7

## 🔗 Links
- [Release Notes](link)
- [Docker Hub](https://hub.docker.com/r/sighadd/whisper-hub)
- [Documentation](link)

Thanks to all contributors! 🙏
```

### 🚨 Security Advisory Template
```markdown
# Security Advisory: Whisper Hub v1.2.x

## Summary
[Brief description of vulnerability]

## Affected Versions
- v1.2.0 through v1.2.2

## Fixed In
- v1.2.3

## Impact
[Description of potential impact]

## Action Required
Update immediately to v1.2.3:
```bash
docker pull sighadd/whisper-hub:1.2.3
```

## References
- CVE-XXXX-XXXX (if applicable)
- [Security details](link)
```

This comprehensive checklist ensures consistent, high-quality releases of your Docker images.