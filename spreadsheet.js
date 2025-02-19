// spreadsheet.js
(function() {
    // Only run on Google Sheets pages.
    if (
        !window.location.hostname.includes("docs.google.com") ||
        !window.location.pathname.includes("/spreadsheets/")
    ) {
        return;
    }

    chrome.storage.sync.get("enableSaveButton", (result) => {
        if (result.enableSaveButton === false) {
            return;
        }

        // Create and style the "Save to Outline" button.
        const saveButton = document.createElement("button");
        saveButton.textContent = "Save to Outline";
        Object.assign(saveButton.style, {
            position: "fixed",
            bottom: "20px",
            right: "20px",
            zIndex: 10000,
            padding: "10px 20px",
            backgroundColor: "#0071e3",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            transition: "background-color 0.5s ease, transform 0.3s ease"
        });
        saveButton.dataset.saved = "false";
        document.body.appendChild(saveButton);

        let isProcessing = false;

        async function handleClick() {
            // Prevent concurrent operations
            if (isProcessing) return;
            isProcessing = true;

            // If already saved, open the document URL.
            if (saveButton.dataset.saved === "true") {
                const url = saveButton.dataset.url;
                if (url) {
                    window.open(url, "_blank");
                }
                isProcessing = false;
                return;
            }

            saveButton.disabled = true;
            saveButton.style.transform = "scale(1.1)";
            saveButton.textContent = "Sending...";
            saveButton.dataset.url = "";

            // Extract the spreadsheet ID from the URL.
            const match = window.location.pathname.match(/\/spreadsheets\/d\/([^\/]+)/);
            if (!match) {
                displayError(saveButton, "Invalid Spreadsheet");
                isProcessing = false;
                return;
            }
            const spreadsheetId = match[1];

            // Get the gid from the URL query parameters (default to "0" if not found).
            const urlParams = new URLSearchParams(window.location.search);
            const gid = urlParams.get("gid") || "0";

            // Build the export URL (TSV format).
            const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=tsv&id=${spreadsheetId}&gid=${gid}`;

            try {
                // Check network connectivity first
                if (!navigator.onLine) {
                    throw new Error("No internet connection");
                }

                const fetchResponse = await fetch(exportUrl);
                if (!fetchResponse.ok) {
                    const statusCode = fetchResponse.status;
                    if (statusCode === 401 || statusCode === 403) {
                        throw new Error("Authentication error. Please make sure you're signed in.");
                    } else if (statusCode === 404) {
                        throw new Error("Spreadsheet not found.");
                    } else if (statusCode >= 500) {
                        throw new Error("Google Sheets server error. Please try again later.");
                    } else {
                        throw new Error(`Failed to fetch spreadsheet (Status: ${statusCode})`);
                    }
                }

                // Check content type to ensure we got the expected format
                const contentType = fetchResponse.headers.get('content-type');
                if (contentType && !contentType.includes('text/') && !contentType.includes('csv')) {
                    throw new Error("Received unexpected file format");
                }

                const tsvContent = await fetchResponse.text();
                if (!tsvContent || tsvContent.trim() === '') {
                    throw new Error("Received empty spreadsheet data");
                }

                // Use the dynamic title for the file name.
                const fileName = `${document.title}.csv`;
                // Create a File object with the dynamic file name.
                const fileObj = new File([tsvContent], fileName, { type: "text/csv" });

                // Generate a dynamic header using current document and time data.
                const now = new Date();
                const headerMarkdown = `| Field | Value |
| ---- | ---- |
| Title | ${document.title} |
| Source | ${window.location.href} |
| Author | (Not specified) |
| Published | (Not specified) |
| Created | ${now.toISOString().split('T')[0]} |
| Clipped Date | ${now.toISOString()} |`;

                // Wrap chrome.runtime.sendMessage in a promise.
                const sendMessagePromise = (msg) =>
                    new Promise((resolve, reject) => {
                        chrome.runtime.sendMessage(msg, (response) => {
                            if (chrome.runtime.lastError) {
                                return reject(chrome.runtime.lastError);
                            }
                            resolve(response);
                        });
                    });

                try {
                    // Send the TSV content along with headerMarkdown, headerPosition, and title.
                    // Passing title will allow the background script to update the document title.
                    const response = await sendMessagePromise({
                        action: "importGoogleSheet",
                        fileContent: tsvContent,
                        headerMarkdown,
                        headerPosition: "top",
                        title: document.title
                    });

                    if (response && response.success) {
                        saveButton.style.backgroundColor = "green";
                        saveButton.textContent = "Saved! (Click to view)";
                        saveButton.dataset.saved = "true";
                        saveButton.dataset.url = response.url || "";
                        saveButton.disabled = false;
                        saveButton.style.transform = "scale(1)";
                    } else {
                        const errorMessage = response && response.error ? response.error : "Unknown error";
                        throw new Error(errorMessage);
                    }
                } catch (messageError) {
                    if (messageError.message.includes("Extension context invalidated")) {
                        throw new Error("Extension reloaded. Please refresh the page and try again.");
                    } else if (messageError.message.includes("Could not establish connection")) {
                        throw new Error("Connection to extension failed. Please refresh the page.");
                    } else {
                        throw messageError;
                    }
                }
            } catch (err) {
                console.error("Export/save error:", err);
                let errorMessage = "Error";

                // Determine appropriate error message based on error type
                if (!navigator.onLine) {
                    errorMessage = "Offline";
                } else if (err.message.includes("Authentication")) {
                    errorMessage = "Auth Error";
                } else if (err.message.includes("Extension") || err.message.includes("Connection")) {
                    errorMessage = "Ext Error";
                } else if (err.message.includes("server error")) {
                    errorMessage = "Server Error";
                } else if (err.message.includes("empty spreadsheet")) {
                    errorMessage = "Empty Data";
                } else if (err.message.includes("unexpected file format")) {
                    errorMessage = "Format Error";
                } else if (err.name === 'TypeError' && err.message.includes('network')) {
                    errorMessage = "Network Error";
                } else if (err.name === 'AbortError') {
                    errorMessage = "Cancelled";
                }

                displayError(saveButton, errorMessage);
            } finally {
                isProcessing = false;
            }
        }

        function displayError(button, message) {
            button.style.backgroundColor = "red";
            button.textContent = message;
            setTimeout(() => {
                button.style.backgroundColor = "#0071e3";
                button.textContent = "Save to Outline";
                button.disabled = false;
                button.style.transform = "scale(1)";
            }, 3000);
        }

        saveButton.addEventListener("click", handleClick);
    });
})();