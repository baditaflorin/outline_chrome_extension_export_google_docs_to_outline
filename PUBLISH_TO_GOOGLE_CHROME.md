# Google Docs/Sheets to Outline Chrome Extension - Comprehensive Publishing Guide

This guide provides detailed instructions for preparing, publishing, and maintaining your Chrome extension in the Chrome Web Store.

## Prerequisites

Before beginning the publishing process, ensure you have:

- A Google developer account with 2FA enabled (strongly recommended for security)
- A Chrome Web Store developer account (requires a one-time $5 registration fee)
- Complete extension files (manifest.json, JavaScript, CSS, icons, etc.)
- Node.js (v14+) and npm (v7+) installed for automation tools
- Git for version control (recommended)
- Chrome browser installed for testing

## Step 1: Final Testing

Before packaging, perform thorough testing:

```bash
# Create a test profile for Chrome
mkdir -p ~/chrome-testing-profile

# Launch Chrome with your extension loaded for testing
google-chrome --user-data-dir=~/chrome-testing-profile --load-extension=/path/to/extension/directory

# Test in incognito mode (if your extension supports it)
google-chrome --user-data-dir=~/chrome-testing-profile --load-extension=/path/to/extension/directory --incognito
```

Verify all functionality works as expected and check for console errors.

## Step 2: Version Management

Update your extension version in manifest.json:

```bash
# Check current version in manifest.json
grep "\"version\"" manifest.json

# Use jq to update version (install with: apt-get install jq or brew install jq)
VERSION=$(grep "\"version\"" manifest.json | cut -d'"' -f4)
NEXT_VERSION=$(echo $VERSION | awk -F. '{$NF++; print $1"."$2"."$NF}')
jq ".version = \"$NEXT_VERSION\"" manifest.json > manifest.json.new && mv manifest.json.new manifest.json

# Verify the update
grep "\"version\"" manifest.json

# Commit version change if using git
git add manifest.json
git commit -m "Bump version to $NEXT_VERSION for release"
git tag "v$NEXT_VERSION"
```

## Step 3: Install Required Tools

```bash
# Install Chrome Web Store CLI (for automated publishing)
npm install -g chrome-webstore-cli

# Install addons-linter (for validation)
npm install -g addons-linter

# Install web-ext (alternative packaging tool)
npm install -g web-ext
```

## Step 4: Validate Your Extension

```bash
# Run the linter to check for common issues
addons-linter /path/to/extension/directory

# Fix any warnings or errors before proceeding
```

## Step 5: Prepare Package Assets

```bash
# Create promotional screenshots directory
mkdir -p promo_assets

# Recommended screenshot dimensions (capture these manually):
# - 1280×800 for desktop
# - 640×400 for Chrome Web Store listing
echo "Don't forget to create screenshots with the following dimensions:"
echo "- 1280×800px (required for Chrome Web Store)"
echo "- 640×400px (additional screenshots)"
echo "- 1400×560px (promotional banner, optional)"
```

## Step 6: Create Extension Package

```bash
# Method 1: Using zip command
# Create a production-ready zip file excluding development files
cd /path/to/extension/directory
zip -r extension.zip . \
  -x "*.git*" "*.DS_Store" \
  "*node_modules*" "*.vscode*" \
  "*.md" "chatgpt.txt" "package*.json" \
  "*.log" "*.tmp" "*temp*" "*test*" \
  "*.pem" "*.crx" "promo_assets/*"

# Method 2: Using web-ext (more robust)
web-ext build \
  --source-dir=/path/to/extension/directory \
  --artifacts-dir=./dist \
  --overwrite-dest \
  --ignore-files="*.git*" "*node_modules*" "*.md" "chatgpt.txt" \
    "package*.json" "*.log" "*.tmp" "*temp*" "*test*" "*.pem"

# Verify the zip contents
unzip -l extension.zip | less
# OR
unzip -l ./dist/*.zip | less
```

## Step 7: Setup Google Cloud Project

For automated publishing, you need API access:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
   ```bash
   # Use gcloud CLI if installed (optional)
   gcloud projects create outline-extension-publisher --name="Outline Extension Publisher"
   ```
3. Enable the Chrome Web Store API
   ```bash
   # Using gcloud CLI (optional)
   gcloud services enable chromewebstore.googleapis.com --project=outline-extension-publisher
   ```
4. Configure OAuth consent screen:
    - Set user type to External
    - Add required scopes for Chrome Web Store API
    - Add yourself as a test user
5. Create OAuth credentials:
    - Create OAuth client ID
    - Application type: Web application
    - Add authorized redirect URIs: `http://localhost:8080/callback`

## Step 8: Get OAuth Tokens

```bash
# Save your credentials securely
mkdir -p ~/.chrome-webstore-keys
chmod 700 ~/.chrome-webstore-keys

# Create .env file for credentials (more secure approach)
cat > ~/.chrome-webstore-keys/.env << EOF
CWS_CLIENT_ID=YOUR_CLIENT_ID
CWS_CLIENT_SECRET=YOUR_CLIENT_SECRET
CWS_REFRESH_TOKEN=YOUR_REFRESH_TOKEN
EOF
chmod 600 ~/.chrome-webstore-keys/.env

# Create a credentials loader script
cat > ~/.chrome-webstore-keys/load_credentials.sh << 'EOF'
#!/bin/bash
# Load environment variables from .env file
if [ -f "$HOME/.chrome-webstore-keys/.env" ]; then
  export $(grep -v '^#' "$HOME/.chrome-webstore-keys/.env" | xargs -0)
fi
EOF
chmod 700 ~/.chrome-webstore-keys/load_credentials.sh

# Create a script to get refresh token
cat > get_refresh_token.sh << 'EOF'
#!/bin/bash
set -e

# Load environment variables from .env
source ~/.chrome-webstore-keys/load_credentials.sh

# Use environment variables for credentials
CLIENT_ID="${CWS_CLIENT_ID}"
CLIENT_SECRET="${CWS_CLIENT_SECRET}"

echo "Visit this URL and authorize the app:"
echo "https://accounts.google.com/o/oauth2/auth?client_id=$CLIENT_ID&response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&redirect_uri=urn:ietf:wg:oauth:2.0:oob"

echo "Enter the authorization code:"
read AUTH_CODE

curl -s -X POST -d "client_id=$CLIENT_ID&client_secret=$CLIENT_SECRET&code=$AUTH_CODE&grant_type=authorization_code&redirect_uri=urn:ietf:wg:oauth:2.0:oob" https://accounts.google.com/o/oauth2/token | jq .
EOF
chmod +x get_refresh_token.sh
```

## Step 9: Upload and Publish Your Extension

Create a publishing script:

```bash
cat > publish_extension.sh << 'EOF'
#!/bin/bash
set -e

# Load environment variables from .env
source ~/.chrome-webstore-keys/load_credentials.sh

# Verify required environment variables are set
if [ -z "$CWS_CLIENT_ID" ] || [ -z "$CWS_CLIENT_SECRET" ] || [ -z "$CWS_REFRESH_TOKEN" ]; then
  echo "Error: Missing required environment variables."
  echo "Please ensure CWS_CLIENT_ID, CWS_CLIENT_SECRET, and CWS_REFRESH_TOKEN are set in ~/.chrome-webstore-keys/.env"
  exit 1
fi

# Get fresh access token
ACCESS_TOKEN=$(curl -s -X POST \
  -d "client_id=${CWS_CLIENT_ID}&client_secret=${CWS_CLIENT_SECRET}&refresh_token=${CWS_REFRESH_TOKEN}&grant_type=refresh_token" \
  https://accounts.google.com/o/oauth2/token | jq -r .access_token)

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" == "null" ]; then
  echo "Error: Failed to obtain access token. Please check your credentials."
  exit 1
fi

# Extension details
EXTENSION_PATH="./extension.zip"
EXTENSION_ID="${1:-}" # Empty for new extensions, pass ID for updates

if [ -z "$EXTENSION_ID" ]; then
  echo "Publishing new extension..."
  RESPONSE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "x-goog-api-version: 2" \
    -X POST \
    -T $EXTENSION_PATH \
    https://www.googleapis.com/upload/chromewebstore/v1.1/items)
  
  # Extract and save extension ID
  EXTENSION_ID=$(echo $RESPONSE | jq -r '.id')
  echo "Extension ID: $EXTENSION_ID" 
  echo $EXTENSION_ID > .extension_id
else
  echo "Updating extension $EXTENSION_ID..."
  RESPONSE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "x-goog-api-version: 2" \
    -X PUT \
    -T $EXTENSION_PATH \
    "https://www.googleapis.com/upload/chromewebstore/v1.1/items/$EXTENSION_ID")
fi

echo "Upload response: $RESPONSE"

# Publish the extension (or submit for review)
echo "Publishing extension..."
PUBLISH_RESPONSE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-goog-api-version: 2" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"target":"default"}' \
  "https://www.googleapis.com/chromewebstore/v1.1/items/$EXTENSION_ID/publish")

echo "Publish response: $PUBLISH_RESPONSE"
EOF
chmod +x publish_extension.sh
```

Run the publishing script:

```bash
# For a new extension
./publish_extension.sh

# For updates (where abc123 is your extension ID)
./publish_extension.sh abc123
```

## Step 10: Manual Publishing Alternative

If you prefer the manual route:

1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Sign in with your Google Account
3. Accept the developer agreement
4. Click "New Item"
5. Upload your zip file
6. Complete the store listing:
    - Detailed description (up to 16,000 characters)
    - At least one screenshot (1280×800)
    - Select category and language
    - Add privacy policy URL
    - List permissions and justifications
    - Provide contact information
7. Submit for review

## Step 11: Monitor Review Status

```bash
# Check extension status
# Install jq if needed: apt-get install jq or brew install jq
curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-goog-api-version: 2" \
  "https://www.googleapis.com/chromewebstore/v1.1/items/$EXTENSION_ID" | jq .

# Setup a cron job to check status daily (optional)
(crontab -l 2>/dev/null; echo "0 9 * * * ~/check_extension_status.sh") | crontab -
```

## Step 12: Post-Publication Tasks

```bash
# Create a release tag in git
git tag -a "release-$NEXT_VERSION" -m "Released version $NEXT_VERSION to Chrome Web Store"
git push origin "release-$NEXT_VERSION"

# Backup your extension package
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p ~/extension_releases
cp extension.zip ~/extension_releases/extension_${NEXT_VERSION}_${TIMESTAMP}.zip
```

## Troubleshooting

### Common Errors and Solutions

#### Upload Failures

```bash
# Verify your OAuth token is valid
curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-goog-api-version: 2" \
  "https://www.googleapis.com/chromewebstore/v1.1/items?projection=draft"

# If unauthorized, refresh your token
ACCESS_TOKEN=$(curl -s -X POST \
  -d "client_id=${CWS_CLIENT_ID}&client_secret=${CWS_CLIENT_SECRET}&refresh_token=${CWS_REFRESH_TOKEN}&grant_type=refresh_token" \
  https://accounts.google.com/o/oauth2/token | jq -r .access_token)
```

#### Manifest Issues

```bash
# Validate manifest.json format
jq . manifest.json

# Check for common manifest errors
echo "Checking for common manifest issues..."
# Missing version
if ! grep -q "\"version\"" manifest.json; then
  echo "ERROR: Missing version in manifest.json"
fi
# Missing name
if ! grep -q "\"name\"" manifest.json; then
  echo "ERROR: Missing name in manifest.json"
fi
# Invalid permissions
PERMISSIONS=$(jq -r '.permissions[]' manifest.json 2>/dev/null)
for p in $PERMISSIONS; do
  if [[ $p == "*://*/*" || $p == "<all_urls>" ]]; then
    echo "WARNING: Very broad host permissions detected: $p"
  fi
done
```

#### Rejection Handling

If your extension is rejected:

1. Check for policy violations:
   ```bash
   # Common policy violation keywords to search for in the rejection email
   KEYWORDS=("deceptive" "permissions" "privacy policy" "functionality" "metadata")
   for keyword in "${KEYWORDS[@]}"; do
     echo "Checking for '$keyword' in rejection email..."
     # Manual step: review rejection email for these keywords
   done
   ```

2. Create a checklist for resubmission:
   ```bash
   cat > resubmission_checklist.txt << EOF
   - [ ] Updated privacy policy to be more specific
   - [ ] Removed unnecessary permissions
   - [ ] Improved extension description
   - [ ] Added detailed permission justifications
   - [ ] Fixed all console errors
   - [ ] Removed IP collection or added disclosure
   - [ ] Ensured all features work as described
   EOF
   ```

## Security Best Practices

```bash
# Verify no secrets are committed
grep -r "apiToken\|secret\|password\|key" --include="*.js" --include="*.json" .

# Check for potential security issues
npm audit

# Create a security policy
cat > SECURITY.md << EOF
# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please email security@example.com.
We'll acknowledge receipt within 24 hours and provide a detailed response within 72 hours.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| $NEXT_VERSION   | :white_check_mark: |
| < $NEXT_VERSION | :x:                |
EOF
```

## Post-Publication Monitoring

```bash
# Create a .env file for monitoring configuration
cat > ~/.extension-monitoring/.env << EOF
EXTENSION_ID=your_extension_id
NOTIFICATION_EMAIL=your_email@example.com
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook/url
LOG_DIR=~/extension_logs
ALERT_THRESHOLD=3
EOF
chmod 600 ~/.extension-monitoring/.env

# Setup monitoring for your extension (example script)
cat > monitor_extension.sh << 'EOF'
#!/bin/bash
set -e

# Load configuration from .env file
if [ -f ~/.extension-monitoring/.env ]; then
  export $(grep -v '^#' ~/.extension-monitoring/.env | xargs -0)
else
  echo "Error: Configuration file not found"
  exit 1
fi

# Verify required variables
if [ -z "$EXTENSION_ID" ] || [ -z "$NOTIFICATION_EMAIL" ]; then
  echo "Error: Required configuration variables missing"
  exit 1
fi

# Create log directory if not exists
mkdir -p "${LOG_DIR:-~/extension_logs}"
LOG_FILE="${LOG_DIR:-~/extension_logs}/monitor_$(date +%Y%m%d).log"

# Check extension status
STATUS=$(curl -s "https://chrome.google.com/webstore/detail/$EXTENSION_ID" -o /dev/null -w "%{http_code}")

if [[ "$STATUS" != "200" ]]; then
  echo "Extension might be down! HTTP status: $STATUS" | 
  mail -s "ALERT: Chrome Extension Status Changed" $EMAIL
fi

# Check your extension reviews (requires parsing HTML or using Web Store API)
# Implementation depends on your monitoring needs
EOF
chmod +x monitor_extension.sh
```

## Environment Management Best Practices

For production environments, follow these best practices:

```bash
# Create a sample .env file with placeholders
cat > .env.sample << EOF
# Chrome Web Store API Credentials
CWS_CLIENT_ID=your_client_id_here
CWS_CLIENT_SECRET=your_client_secret_here
CWS_REFRESH_TOKEN=your_refresh_token_here

# Extension Details
EXTENSION_ID=
EXTENSION_VERSION=1.0.0

# Notification Settings
NOTIFICATION_EMAIL=your_email@example.com
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook/url

# Deployment Settings
AUTO_PUBLISH=false
ENVIRONMENT=development
EOF

# Create a credential rotation script
cat > rotate_credentials.sh << 'EOF'
#!/bin/bash
set -e

# Load current credentials
source ~/.chrome-webstore-keys/load_credentials.sh

# Generate new client secret (requires manual step in Google Cloud Console)
echo "Please generate a new client secret in Google Cloud Console"
echo "Visit: https://console.cloud.google.com/apis/credentials"
echo "Press Enter after generating the new secret"
read -p ""

echo "Enter the new client secret:"
read -s NEW_CLIENT_SECRET
echo

# Update the .env file with the new secret
sed -i "s/CWS_CLIENT_SECRET=.*/CWS_CLIENT_SECRET=$NEW_CLIENT_SECRET/" ~/.chrome-webstore-keys/.env

echo "Credentials updated successfully"
echo "Remember to securely delete any backups containing the old secret"
EOF
chmod +x rotate_credentials.sh

# Create a validation script for environment variables
cat > validate_env.sh << 'EOF'
#!/bin/bash

ENV_FILE="${1:-~/.chrome-webstore-keys/.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: Environment file not found: $ENV_FILE"
  exit 1
fi

# Load variables without executing
declare -A required_vars=(
  ["CWS_CLIENT_ID"]="Google Cloud OAuth Client ID"
  ["CWS_CLIENT_SECRET"]="Google Cloud OAuth Client Secret"
  ["CWS_REFRESH_TOKEN"]="OAuth Refresh Token"
)

missing_vars=0
while IFS='=' read -r key value || [ -n "$key" ]; do
  # Skip comments and empty lines
  [[ $key =~ ^# ]] || [ -z "$key" ] && continue
  
  # Trim whitespace
  key=$(echo "$key" | xargs)
  value=$(echo "$value" | xargs)
  
  # Check if required variable is empty
  if [[ ${required_vars[$key]} ]] && [ -z "$value" ]; then
    echo "Error: Required variable '$key' (${required_vars[$key]}) is empty"
    missing_vars=$((missing_vars + 1))
  fi
done < "$ENV_FILE"

if [ $missing_vars -gt 0 ]; then
  echo "Found $missing_vars missing required variables"
  exit 1
fi

echo "Environment validation successful"
EOF
chmod +x validate_env.sh
```

## Additional Resources

- [Chrome Developer Documentation](https://developer.chrome.com/docs/extensions/)
- [Chrome Web Store Developer Program Policies](https://developer.chrome.com/docs/webstore/program-policies/)
- [Publishing to the Chrome Web Store](https://developer.chrome.com/docs/webstore/publish/)
- [Chrome Web Store API](https://developer.chrome.com/docs/webstore/api_index/)
- [Chrome Extensions Samples](https://github.com/GoogleChrome/chrome-extensions-samples)