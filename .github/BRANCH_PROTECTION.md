# Branch Protection Configuration

This document outlines the recommended branch protection settings for the Whisper Hub repository.

## Main Branch Protection Rules

### Required Status Checks
The following checks must pass before merging to `main`:

#### Critical Checks (Must Pass)
- ✅ **Backend Tests (Go)** - `backend-tests`
- ✅ **Frontend Tests (Node.js)** - `frontend-tests` 
- ✅ **Docker Build Test** - `docker-build`
- ✅ **PR Validation** - `pr-validation`
- ✅ **Code Quality Checks** - `code-quality`

#### Important Checks (Should Pass)
- ⚠️ **Integration Tests** - `integration-tests` (may require API key)
- ⚠️ **Security & Quality** - `security-quality`
- ⚠️ **Performance Tests** - `performance-tests`
- ⚠️ **Performance Impact** - `performance-impact`

### Repository Settings

#### General Protection
- [x] Require pull request reviews before merging
- [x] Require review from code owners (if CODEOWNERS file exists)
- [x] Dismiss stale reviews when new commits are pushed
- [x] Require status checks to pass before merging
- [x] Require branches to be up to date before merging
- [x] Require conversation resolution before merging

#### Additional Restrictions
- [x] Restrict pushes that create files larger than 100MB
- [x] Restrict force pushes
- [x] Restrict deletions
- [x] Allow administrators to bypass these restrictions (for emergencies)

#### Auto-merge Settings
- [x] Allow auto-merge
- [x] Automatically delete head branches after merge

## GitHub Repository Configuration Commands

To set up these branch protection rules via GitHub CLI:

```bash
# Install GitHub CLI if not already installed
# brew install gh  # macOS
# apt install gh   # Ubuntu

# Authenticate with GitHub
gh auth login

# Set up branch protection for main branch
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["backend-tests","frontend-tests","docker-build","pr-validation","code-quality"]}' \
  --field enforce_admins=false \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true,"require_code_owner_reviews":false}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false

# Set up additional repository settings
gh api repos/:owner/:repo \
  --method PATCH \
  --field delete_branch_on_merge=true \
  --field allow_auto_merge=true \
  --field allow_merge_commit=true \
  --field allow_squash_merge=true \
  --field allow_rebase_merge=false
```

## Required Secrets

The following repository secrets need to be configured:

### Optional Secrets (for full CI functionality)
- `OPENAI_API_KEY_TEST` - Test API key for integration tests (limited quota)
- `CODECOV_TOKEN` - For coverage reporting (if using Codecov)

### Note on API Keys
Integration tests can run without the OpenAI API key - they will skip tests that require external API calls.

## Manual Setup via GitHub Web Interface

1. Go to **Settings** → **Branches**
2. Click **Add rule** or edit existing rule for `main`
3. Configure the following:

### Branch name pattern
```
main
```

### Protect matching branches
- [x] Require pull request reviews before merging
  - Required approving reviews: **1**
  - [x] Dismiss stale reviews when new commits are pushed
  - [ ] Require review from code owners (optional)

- [x] Require status checks to pass before merging
  - [x] Require branches to be up to date before merging
  - Status checks found in the last week:
    - [x] `backend-tests`
    - [x] `frontend-tests`
    - [x] `docker-build`
    - [x] `pr-validation`
    - [x] `code-quality`

- [x] Require conversation resolution before merging
- [ ] Require signed commits (optional)
- [x] Restrict pushes that create files larger than 100 MB
- [ ] Allow force pushes (keep unchecked)
- [ ] Allow deletions (keep unchecked)

## Workflow File Locations

The CI/CD pipeline consists of these workflow files:
- `.github/workflows/ci.yml` - Main CI/CD pipeline
- `.github/workflows/pr-checks.yml` - PR-specific quality checks

## Testing the Pipeline

1. **Create a test PR** to verify all checks run correctly
2. **Verify status checks** appear in PR status section
3. **Test failure scenarios** by introducing intentional test failures
4. **Confirm merge protection** prevents merging with failed checks

## Troubleshooting

### Common Issues

**Status checks not appearing:**
- Ensure workflow files are on the main branch
- Check workflow syntax with `gh workflow view`
- Verify required status check names match workflow job names

**Tests failing in CI but passing locally:**
- Check environment differences (Go version, dependencies)
- Verify secrets are configured if needed
- Review CI logs for specific error messages

**Performance checks failing:**
- Review benchmark thresholds in workflows
- Adjust performance criteria if legitimate changes occurred
- Consider if performance regression is acceptable for new features

## Updating Protection Rules

When adding new required checks:
1. First deploy the workflow changes to main
2. Let the workflow run on a few PRs to verify stability
3. Then add the new check to branch protection rules
4. Update this documentation

This ensures new checks are working before making them mandatory.