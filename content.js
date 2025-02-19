(function() {
    // Only run on Google Docs pages.
    if (
        !window.location.hostname.includes("docs.google.com") ||
        !window.location.pathname.includes("/document/")
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
            if (isProcessing) return;
            isProcessing = true;

            // Proceed with saving logic.
            saveButton.disabled = true;
            saveButton.style.transform = "scale(1.1)";
            saveButton.textContent = "Sending...";
            saveButton.dataset.url = "";

            // Extract the document ID from the URL.
            const match = window.location.pathname.match(/\/document\/d\/([^\/]+)/);
            if (!match) {
                displayError(saveButton, "Invalid Document");
                isProcessing = false;
                return;
            }
            const docId = match[1];
            // Build the export URL (Markdown format).
            const exportUrl = `https://docs.google.com/document/u/0/export?format=md&id=${docId}`;

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
                        throw new Error("Document not found.");
                    } else if (statusCode >= 500) {
                        throw new Error("Google Docs server error. Please try again later.");
                    } else {
                        throw new Error(`Failed to fetch document (Status: ${statusCode})`);
                    }
                }
                const markdown = await fetchResponse.text();

                // Create dynamic header markdown using document and time data.
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
                    // Send the title, document content, header markdown, and header position ("top").
                    const response = await sendMessagePromise({
                        action: "saveGoogleDoc",
                        title: document.title,
                        content: markdown,
                        headerMarkdown,      // Dynamic header.
                        headerPosition: "top" // Prepend header at the top.
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

        // Separate the click listener:
        // If the document is already saved, open the URL immediately.
        // Otherwise, call the async handler.
        saveButton.addEventListener("click", () => {
            if (saveButton.dataset.saved === "true") {
                const url = saveButton.dataset.url;
                if (url) {
                    window.open(url, "_blank");
                }
            } else {
                handleClick();
            }
        });
    });
})();