// content.js
(function() {
    // Only run on Google Docs pages
    if (!window.location.hostname.includes("docs.google.com") ||
        !window.location.pathname.includes("/document/")) {
        return;
    }

    // Check if the save button is enabled via options
    chrome.storage.sync.get("enableSaveButton", (result) => {
        // If the setting is explicitly false, do not show the button.
        if (result.enableSaveButton === false) {
            return;
        }

        // Create and style the “Save to Outline” button
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
        // Track saved state and URL via data attributes
        saveButton.dataset.saved = "false";
        document.body.appendChild(saveButton);

        async function handleClick() {
            // If already saved, open the document URL in a new tab
            if (saveButton.dataset.saved === "true") {
                const url = saveButton.dataset.url;
                if (url) {
                    window.open(url, "_blank");
                }
                return;
            }

            // Disable the button to prevent multiple clicks
            saveButton.disabled = true;
            saveButton.style.transform = "scale(1.1)";
            saveButton.textContent = "Sending...";

            // Remove any previously set data
            saveButton.dataset.url = "";

            // Extract the document ID from the URL (format: /document/d/XYZ/edit)
            const match = window.location.pathname.match(/\/document\/d\/([^\/]+)/);
            if (!match) {
                saveButton.style.backgroundColor = "red";
                saveButton.textContent = "Invalid Document";
                setTimeout(() => {
                    saveButton.style.backgroundColor = "#0071e3";
                    saveButton.textContent = "Save to Outline";
                    saveButton.disabled = false;
                    saveButton.style.transform = "scale(1)";
                }, 3000);
                return;
            }
            const docId = match[1];

            // Build the export URL using the extracted docId
            const exportUrl = `https://docs.google.com/document/u/0/export?format=md&id=${docId}`;

            try {
                // Fetch the document’s Markdown content
                const fetchResponse = await fetch(exportUrl);
                if (!fetchResponse.ok) {
                    throw new Error("Failed to fetch document. Are you signed in?");
                }
                const markdown = await fetchResponse.text();

                // Wrap chrome.runtime.sendMessage in a promise
                const sendMessagePromise = (msg) =>
                    new Promise((resolve, reject) => {
                        chrome.runtime.sendMessage(msg, (response) => {
                            if (chrome.runtime.lastError) {
                                return reject(chrome.runtime.lastError);
                            }
                            resolve(response);
                        });
                    });

                // Send the title and markdown content to the background script
                const response = await sendMessagePromise({
                    action: "saveGoogleDoc",
                    title: document.title,
                    content: markdown
                });

                if (response && response.success) {
                    // On success: turn button green, update text and mark as saved with URL
                    saveButton.style.backgroundColor = "green";
                    saveButton.textContent = "Saved! (Click to view)";
                    saveButton.dataset.saved = "true";
                    saveButton.dataset.url = response.url || "";
                    saveButton.disabled = false;
                    saveButton.style.transform = "scale(1)";
                } else {
                    // On error: animate button to red and revert after a delay
                    saveButton.style.backgroundColor = "red";
                    saveButton.textContent = "Error";
                    setTimeout(() => {
                        saveButton.style.backgroundColor = "#0071e3";
                        saveButton.textContent = "Save to Outline";
                        saveButton.disabled = false;
                        saveButton.style.transform = "scale(1)";
                    }, 3000);
                }
            } catch (err) {
                // Handle any errors during fetch or sending
                saveButton.style.backgroundColor = "red";
                saveButton.textContent = "Error";
                setTimeout(() => {
                    saveButton.style.backgroundColor = "#0071e3";
                    saveButton.textContent = "Save to Outline";
                    saveButton.disabled = false;
                    saveButton.style.transform = "scale(1)";
                }, 3000);
            }
        }

        saveButton.addEventListener("click", handleClick);
    });
})();
