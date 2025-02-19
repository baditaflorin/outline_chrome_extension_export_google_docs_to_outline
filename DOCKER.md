# Chrome Extension Development Environment

This Docker environment provides everything you need for Chrome extension development, testing, and publishing. It includes a CLI tool for common extension tasks, a Chrome browser for testing, and a test runner.

## Setup

1. Copy the `.env.sample` file to `.env` and fill in your credentials:

```bash
cp .env.sample .env
```

2. Start the Docker environment:

```bash
docker-compose up -d
```

3. Access the CLI container:

```bash
docker-compose exec chrome-extension-cli bash
```

## Using the Extension CLI

The environment comes with a custom `extension` CLI tool that simplifies common tasks:

### Building Your Extension

```bash
extension build
```

This packages your extension into a ZIP file ready for testing or publication.

### Validating Your Extension

```bash
extension validate
```

Runs checks on your extension to identify common issues before submission.

### Publishing to Chrome Web Store

For a new extension:
```bash
extension publish
```

For updating an existing extension:
```bash
extension update --id your_extension_id
```

Or using the saved ID:
```bash
extension update
```

### Checking Publication Status

```bash
extension check-status
```

### Getting a Fresh Access Token

```bash
extension get-token
```

## Testing Your Extension

The environment includes a Chrome browser accessible via Selenium for automated testing:

1. Write tests using Selenium WebDriver or Puppeteer
2. Run tests through the extension-tester service:

```bash
docker-compose run extension-tester
```

### Visual Debugging

The Chrome browser container includes a VNC server that allows you to watch tests being executed:

1. Connect to `localhost:7900` with a VNC client or web browser
2. Default password: `secret`

## Directory Structure

```
├── .env                  # Environment variables (create from .env.sample)
├── docker-compose.yml    # Docker services configuration
├── Dockerfile.extension  # Chrome extension CLI environment
├── Dockerfile.tester     # Test runner environment
├── scripts/
│   └── extension-cli.sh  # CLI helper script
├── test/                 # Your test files
└── ...                   # Your extension files
```

## Best Practices

1. Always validate before publishing
2. Store credentials securely
3. Version your extension properly in manifest.json
4. Run automated tests before submission
5. Check publication status after submission

## Troubleshooting

### Common Issues

- **"Invalid credentials"**: Ensure your OAuth credentials are correct and refresh token is valid
- **"Connection refused"**: Make sure all containers are running (`docker-compose ps`)
- **"Extension validation failed"**: Review validation errors and fix issues in your extension
- **"Upload failed"**: Check ZIP file contents and Chrome Web Store API status

### Container Logs

```bash
docker-compose logs chrome-extension-cli
docker-compose logs chrome-browser
docker-compose logs extension-tester
```

## Important Notes

- Chrome Web Store submissions can take several days for review
- Keep your credentials secure and never commit them to version control
- Regularly update your extension to maintain compliance with Chrome Web Store policies