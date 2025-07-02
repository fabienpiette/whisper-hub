# Docker Hub Token Setup Guide

## Creating the Docker Hub Access Token

### Step 1: Generate Token
1. Go to [Docker Hub Account Settings](https://hub.docker.com/settings/security)
2. Click **"New Access Token"**
3. Configure:
   - **Token description:** `GitHub Actions Whisper Hub`
   - **Access permissions:** Select **"Read, Write, Delete"**
4. Click **"Generate"**
5. **Copy the token immediately** (shown only once)

### Step 2: Add to GitHub Repository
1. Go to your GitHub repository
2. Navigate: **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"** (not environment secret)
4. Configure:
   - **Name:** `DOCKER_HUB_TOKEN`
   - **Secret:** Paste your Docker Hub token
5. Click **"Add secret"**

## Verification Checklist

### ✅ Token Requirements
- [ ] Token has **Read, Write, Delete** permissions
- [ ] Token description is meaningful (e.g., "GitHub Actions Whisper Hub")
- [ ] Token is copied correctly (no extra spaces/characters)

### ✅ GitHub Secret Requirements  
- [ ] Secret name is exactly `DOCKER_HUB_TOKEN`
- [ ] Added as **Repository Secret** (not Environment Secret)
- [ ] No extra spaces in the secret value
- [ ] Repository owner has access to manage secrets

### ✅ Repository Requirements
- [ ] Repository `sighadd/whisper-hub` exists on Docker Hub
- [ ] Account `sighadd` has push permissions to the repository
- [ ] Repository is public (or private with appropriate permissions)

## Common Issues & Solutions

### Issue: "Password required" Error
**Cause:** Secret not properly configured or accessible
**Solution:**
1. Verify secret exists in repository settings
2. Check secret name is exactly `DOCKER_HUB_TOKEN`
3. Ensure it's a repository secret, not environment secret
4. Regenerate Docker Hub token if needed

### Issue: "Repository does not exist"
**Cause:** Docker Hub repository not created
**Solution:**
1. Go to [Docker Hub](https://hub.docker.com)
2. Click **"Create Repository"**
3. Set name as `whisper-hub`
4. Set visibility as **Public**
5. Click **"Create"**

### Issue: "Access denied"
**Cause:** Insufficient permissions
**Solution:**
1. Verify you own the `sighadd` Docker Hub account
2. Check token has **Write** permissions
3. Verify repository permissions

### Issue: Environment vs Repository Secrets
**Environment Secret** (Limited scope):
- Only works for specific environments
- Shows environment name in secrets list
- Not recommended for Docker releases

**Repository Secret** (Recommended):
- Works for all workflows in the repository
- No environment restrictions
- Appears in main secrets list

## Testing Your Setup

### Test 1: Manual Workflow Trigger
1. Go to **Actions** tab in your GitHub repository
2. Select **"Test Docker Authentication"** workflow
3. Click **"Run workflow"** → **"Run workflow"**
4. Check results - should show "✅ Successfully authenticated"

### Test 2: Local Testing (Optional)
```bash
# Export your Docker Hub token
export DOCKER_HUB_TOKEN="your_actual_token_here"

# Test authentication
echo "$DOCKER_HUB_TOKEN" | docker login -u sighadd --password-stdin

# Test repository access
docker pull sighadd/whisper-hub:latest || echo "Repository is empty (normal)"

# Logout
docker logout
```

### Test 3: Repository Creation Test
```bash
# Try to access the repository page
curl -s https://hub.docker.com/v2/repositories/sighadd/whisper-hub/ | jq .
```

## Troubleshooting Commands

### Check Docker Hub Repository Status
```bash
# Using curl to check if repository exists
curl -s "https://hub.docker.com/v2/repositories/sighadd/whisper-hub/" \
  | jq -r '.name // "Repository not found"'
```

### Validate Token Format
Docker Hub tokens should:
- Start with `dckr_pat_`
- Be approximately 36+ characters long
- Contain alphanumeric characters and hyphens

### Common Token Issues
```bash
# Incorrect token format examples:
❌ "password123"           # This is a password, not a token
❌ "ghp_xxxxxxxxxxxx"      # This is a GitHub token, not Docker Hub
❌ "dckr_pat_xxx xxx"      # Contains spaces
✅ "dckr_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  # Correct format
```

## Security Best Practices

### Token Management
- [ ] Use descriptive token names
- [ ] Set minimal required permissions
- [ ] Rotate tokens regularly (every 6-12 months)
- [ ] Delete unused tokens
- [ ] Monitor token usage in Docker Hub logs

### Secret Management
- [ ] Use repository secrets for CI/CD
- [ ] Never commit secrets to code
- [ ] Use environment-specific secrets when needed
- [ ] Regularly audit secret access
- [ ] Document secret purposes

### Repository Security
- [ ] Enable Docker Hub security scanning
- [ ] Use official base images
- [ ] Keep dependencies updated
- [ ] Monitor for vulnerabilities
- [ ] Set up automated security alerts

## Next Steps After Setup

1. **Test the authentication workflow**
2. **Run a sample Docker build**
3. **Verify multi-platform support**
4. **Set up automated releases**
5. **Configure monitoring and alerts**

## Support Resources

- **Docker Hub Documentation:** https://docs.docker.com/docker-hub/
- **GitHub Secrets Documentation:** https://docs.github.com/en/actions/security-guides/encrypted-secrets
- **Docker Hub Support:** https://hub.docker.com/support/
- **Repository Issues:** Use GitHub Issues for community support