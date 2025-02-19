// content.js
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

        // Create container for the floating button
        const buttonContainer = document.createElement("div");
        Object.assign(buttonContainer.style, {
            position: "fixed",
            bottom: "20px",
            right: "20px",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            transition: "all 0.3s ease"
        });

        // Create the icon button
        const iconButton = document.createElement("div");
        Object.assign(iconButton.style, {
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            backgroundColor: "#0071e3",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
            transition: "transform 0.3s ease, background-color 0.5s ease"
        });
        iconButton.dataset.saved = "false";

        // Create icon element (using extension's icon)
        const iconElement = document.createElement("img");
        try {
            iconElement.src = chrome.runtime.getURL("icons/icon48.png");
            iconElement.onerror = () => {
                // Fallback to a text icon if image loading fails
                iconElement.remove();
                iconButton.textContent = "O";
                iconButton.style.fontWeight = "bold";
                iconButton.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
                iconButton.style.fontSize = "16px";
                iconButton.style.color = "#fff";
            };
        } catch (e) {
            // If chrome.runtime.getURL fails, use text fallback
            iconButton.textContent = "O";
            iconButton.style.fontWeight = "bold";
            iconButton.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
            iconButton.style.fontSize = "16px";
            iconButton.style.color = "#fff";
        }
        iconElement.style.width = "24px";
        iconElement.style.height = "24px";
        iconElement.style.objectFit = "contain";
        iconButton.appendChild(iconElement);

        // Create text label that appears on hover
        const textLabel = document.createElement("div");
        textLabel.textContent = "Save to Outline";
        Object.assign(textLabel.style, {
            backgroundColor: "#0071e3",
            color: "#fff",
            padding: "8px 12px",
            borderRadius: "6px",
            marginRight: "10px",
            opacity: "0",
            transform: "translateX(10px)",
            transition: "opacity 0.3s ease, transform 0.3s ease",
            whiteSpace: "nowrap",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            fontSize: "14px",
            fontWeight: "500"
        });

        // Add elements to the container
        buttonContainer.appendChild(textLabel);
        buttonContainer.appendChild(iconButton);
        document.body.appendChild(buttonContainer);

        // Show/hide text on hover
        buttonContainer.addEventListener("mouseenter", () => {
            textLabel.style.opacity = "1";
            textLabel.style.transform = "translateX(0)";
        });

        buttonContainer.addEventListener("mouseleave", () => {
            textLabel.style.opacity = "0";
            textLabel.style.transform = "translateX(10px)";
        });

        let isProcessing = false;
        let timeoutId = null;

        async function handleClick() {
            if (isProcessing) return;
            isProcessing = true;

            // Proceed with saving logic.
            iconButton.style.pointerEvents = "none";
            iconButton.style.transform = "scale(1.1)";

            // Update the text label to show progress
            textLabel.textContent = "Sending...";
            textLabel.style.opacity = "1";
            iconButton.dataset.url = "";

            // Set a global timeout to prevent hanging requests
            timeoutId = setTimeout(() => {
                if (isProcessing) {
                    displayError("Timeout");
                    isProcessing = false;
                    if (timeoutId) clearTimeout(timeoutId);
                }
            }, 60000); // 60-second timeout

            // Extract the document ID from the URL.
            const match = window.location.pathname.match(/\/document\/d\/([^\/]+)/);
            if (!match) {
                displayError("Invalid Document");
                isProcessing = false;
                if (timeoutId) clearTimeout(timeoutId);
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

                // Use AbortController for fetch timeout
                const controller = new AbortController();
                const fetchTimeout = setTimeout(() => controller.abort(), 30000); // 30-second fetch timeout

                const fetchResponse = await fetch(exportUrl, {
                    signal: controller.signal
                }).finally(() => {
                    clearTimeout(fetchTimeout);
                });

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

                const contentType = fetchResponse.headers.get('content-type');
                if (contentType && !contentType.includes('text/')) {
                    throw new Error("Received unexpected file format");
                }

                const markdown = await fetchResponse.text();
                if (!markdown || markdown.trim() === '') {
                    throw new Error("Received empty document data");
                }

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
                        const messageTimeout = setTimeout(() => {
                            reject(new Error("Message timeout"));
                        }, 30000); // 30-second message timeout

                        chrome.runtime.sendMessage(msg, (response) => {
                            clearTimeout(messageTimeout);
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
                        iconButton.style.backgroundColor = "green";
                        textLabel.style.backgroundColor = "green";
                        textLabel.textContent = "Saved! Click to view";
                        textLabel.style.opacity = "1";
                        iconButton.dataset.saved = "true";
                        iconButton.dataset.url = response.url || "";
                        iconButton.style.pointerEvents = "auto";
                        iconButton.style.transform = "scale(1)";

                        // Keep the text visible for a moment
                        setTimeout(() => {
                            if (!buttonContainer.matches(':hover')) {
                                textLabel.style.opacity = "0";
                                textLabel.style.transform = "translateX(10px)";
                            }
                        }, 2000);
                    } else {
                        const errorMessage = response && response.error ? response.error : "Unknown error";
                        throw new Error(errorMessage);
                    }
                } catch (messageError) {
                    if (messageError.message.includes("Extension context invalidated")) {
                        throw new Error("Extension reloaded. Please refresh the page and try again.");
                    } else if (messageError.message.includes("Could not establish connection")) {
                        throw new Error("Connection to extension failed. Please refresh the page.");
                    } else if (messageError.message.includes("Message timeout")) {
                        throw new Error("Operation timed out. Please try again.");
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
                } else if (err.message.includes("empty document")) {
                    errorMessage = "Empty Data";
                } else if (err.message.includes("unexpected file format")) {
                    errorMessage = "Format Error";
                } else if (err.name === 'TypeError' && err.message.includes('network')) {
                    errorMessage = "Network Error";
                } else if (err.name === 'AbortError' || err.message.includes('timed out')) {
                    errorMessage = "Timeout";
                } else {
                    errorMessage = "Error: " + (err.message?.slice(0, 15) || "Unknown");
                }

                displayError(errorMessage);
            } finally {
                isProcessing = false;
                if (timeoutId) clearTimeout(timeoutId);
            }
        }

        function displayError(message) {
            iconButton.style.backgroundColor = "red";
            textLabel.style.backgroundColor = "red";
            textLabel.textContent = message;
            textLabel.style.opacity = "1";

            console.error(`Error during export: ${message}`);

            setTimeout(() => {
                iconButton.style.backgroundColor = "#0071e3";
                textLabel.style.backgroundColor = "#0071e3";
                textLabel.textContent = "Save to Outline";
                iconButton.style.pointerEvents = "auto";
                iconButton.style.transform = "scale(1)";

                // Hide the text label after showing the error
                if (!buttonContainer.matches(':hover')) {
                    textLabel.style.opacity = "0";
                    textLabel.style.transform = "translateX(10px)";
                }
            }, 3000);
        }

        // Click handler
        buttonContainer.addEventListener("click", () => {
            if (iconButton.dataset.saved === "true") {
                const url = iconButton.dataset.url;
                if (url) {
                    window.open(url, "_blank");
                }
            } else {
                handleClick();
            }
        });
    });
})();