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

        // Create and style the “Save to Outline” button.
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

        async function handleClick() {
            // If already saved, open the document URL.
            if (saveButton.dataset.saved === "true") {
                const url = saveButton.dataset.url;
                if (url) {
                    window.open(url, "_blank");
                }
                return;
            }

            saveButton.disabled = true;
            saveButton.style.transform = "scale(1.1)";
            saveButton.textContent = "Sending...";
            saveButton.dataset.url = "";

            // Extract the document ID from the URL.
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
            // Build the export URL (Markdown format).
            const exportUrl = `https://docs.google.com/document/u/0/export?format=md&id=${docId}`;

            try {
                const fetchResponse = await fetch(exportUrl);
                if (!fetchResponse.ok) {
                    throw new Error("Failed to fetch document. Are you signed in?");
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

                // Send the title, document content, dynamic header markdown, and specify header position ("top").
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
