# Google Docs/Sheets to Outline

![Extension Version](https://img.shields.io/badge/version-1.2-blue)
![License](https://img.shields.io/badge/license-MIT-green)

A Chrome extension that seamlessly exports Google Docs and Google Sheets to your [Outline](https://www.getoutline.com/) knowledge base as beautifully formatted Markdown documents.

<p align="center">
  <img src="icons/icon128.png" alt="Extension Logo" width="128" height="128">
</p>

## Features

- **One-Click Export**: Add a convenient "Save to Outline" button to your Google Docs and Sheets
- **Markdown Conversion**: Automatically converts Google Docs to Markdown format
- **Spreadsheet Support**: Exports Google Sheets to CSV format that Outline can render as tables
- **Document Organization**: Uses configurable collections to organize your exported content
- **Metadata Preservation**: Automatically adds source URLs, export dates, and other metadata
- **User-Configurable**: Choose your own collection names and toggle UI elements
- **Offline Support**: Gracefully handles connection issues with informative error messages
- **Secure**: Uses API tokens for authentication and secure HTTPS communication

## Installation

### From Chrome Web Store

1. Visit the [Google Docs/Sheets to Outline](https://chrome.google.com/webstore/detail/your-extension-id) extension page
2. Click "Add to Chrome"
3. When prompted, click "Add extension"

### Manual Installation (Developer Mode)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked" and select the extension directory
5. The extension should now appear in your extensions list

## Setup

Before using the extension, you need to configure it with your Outline credentials:

1. Click the extension icon in your Chrome toolbar
2. Enter the following information:
    - **Outline API Base URL**: The URL of your Outline instance (e.g., `https://app.getoutline.com` or your custom domain)
    - **API Token**: Your personal Outline API token
    - **Google Docs Collection Name**: (Optional) Default: "google-docs"
    - **Google Sheets Collection Name**: (Optional) Default: "google-sheets"
3. Click "Save Settings"
4. Click "Test Connection" to verify your configuration works

### Getting Your Outline API Token

1. Log in to your Outline instance
2. Go to Settings → API Tokens
3. Create a new personal token with appropriate permissions
4. Copy the token and paste it into the extension settings

## Usage

### Exporting Google Docs

1. Open any Google Document
2. Look for the "Save to Outline" button in the bottom-right corner
3. Click the button to export the document
4. The button will turn green and display "Saved!" when complete
5. Click the button again to open the document in Outline

### Exporting Google Sheets

1. Open any Google Spreadsheet
2. Look for the "Save to Outline" button in the bottom-right corner
3. Click the button to export the current sheet as CSV
4. The button will turn green and display "Saved!" when complete
5. Click the button again to open the document in Outline

### Advanced Options

You can disable the floating "Save to Outline" button by unchecking "Show 'Save to Outline' Button on Documents" in the extension options.

## How It Works

This extension:

1. Exports your Google Doc as Markdown or your Google Sheet as CSV
2. Creates or identifies the appropriate collection in your Outline instance
3. Uploads the converted document to your Outline knowledge base
4. Adds metadata including the original document URL and export date
5. Returns a link to the newly created Outline document

## Troubleshooting

### Common Issues

| Problem | Solution |
|---------|----------|
| "Auth Error" | Check your API token and ensure it has the correct permissions |
| "Offline" | Check your internet connection and try again |
| "Server Error" | Wait a few minutes and try again; Outline server may be temporarily unavailable |
| "Format Error" | Try with a simpler document or sheet first |
| "Ext Error" | Refresh the page or reinstall the extension |

### Logs

To view extension logs:
1. Right-click the page and select "Inspect"
2. Go to the "Console" tab
3. Look for logs prefixed with [INFO], [DEBUG], or [ERROR]

## Privacy

This extension:
- Does not collect or store your document content
- Transmits data directly from Google to your Outline instance
- Stores configuration data locally in your browser
- Does not use analytics or tracking

For complete details, see our [Privacy Policy](PRIVACY.md).

## Security Considerations

- Your API token is stored locally in your browser using Chrome's secure storage API
- All communication with Outline occurs over HTTPS
- The extension requests only the permissions it needs to function
- Document content is never sent to any third-party servers

## Development

### Project Structure

```
├── manifest.json       # Extension configuration
├── background.js       # Service worker for API communication
├── content.js          # Google Docs integration
├── spreadsheet.js      # Google Sheets integration
├── outlineAPI.js       # Outline API client
├── headerUpdateHelper.js # Document header management
├── storage.js          # Storage utilities
├── logger.js           # Logging utilities
├── options.html        # Settings page
├── options.js          # Settings functionality
├── styles/
│   └── options.css     # Settings page styling
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Building from Source

1. Clone the repository
```bash
git clone https://github.com/your-username/outline_chrome_extension_export_google_docs_to_outline.git
cd outline_chrome_extension_export_google_docs_to_outline
```

2. Make your changes

3. Load the unpacked extension in Chrome:
    - Navigate to `chrome://extensions/`
    - Enable "Developer mode"
    - Click "Load unpacked" and select the extension directory

### Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Outline](https://www.getoutline.com/) for their excellent knowledge base software and API
- The Chrome Extensions team for their comprehensive documentation
- Contributors who have helped improve this extension

## Version History

- **1.2** - Added support for Google Sheets export
- **1.1** - Improved error handling and offline support
- **1.0** - Initial release with Google Docs support

## Roadmap

- [ ] Support for exporting Google Slides
- [ ] Batch export of multiple documents
- [ ] Custom templates for document formatting
- [ ] Configurable keyboard shortcuts
- [ ] Dark mode support for the options page

## Contact

If you have questions, suggestions, or need help, please:
- Open an issue in our [GitHub repository](https://github.com/your-username/outline_chrome_extension_export_google_docs_to_outline/issues)
- Email us at your-email@example.com

---

<p align="center">
  Made with ❤️ for Outline users
</p>