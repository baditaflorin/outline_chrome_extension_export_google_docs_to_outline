// content.js
(function() {
    // Only run on Google Docs pages
    if (!window.location.hostname.includes("docs.google.com") ||
        !window.location.pathname.includes("/document/")) {
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
        cursor: "pointer"
    });
    document.body.appendChild(saveButton);

    saveButton.addEventListener("click", async () => {
        // Extract the document ID from the URL (format: /document/d/XYZ/edit)
        const match = window.location.pathname.match(/\/document\/d\/([^\/]+)/);
        if (!match) {
            alert("Unable to detect document ID.");
            return;
        }
        const docId = match[1]; // Define docId here

        // Build the export URL using the extracted docId
        const exportUrl = `https://docs.google.com/document/u/0/export?format=md&id=${docId}`;

        try {
            // Fetch the document’s Markdown content
            const response = await fetch(exportUrl);
            if (!response.ok) {
                throw new Error("Failed to fetch document. Are you signed in?");
            }
            const markdown = await response.text();

            // Send the title and markdown content to the background script
            chrome.runtime.sendMessage({
                action: "saveGoogleDoc",
                title: document.title,
                content: markdown
            }, (response) => {
                if (response && response.success) {
                    alert("Document saved to Outline!\n" + (response.url || ""));
                } else {
                    alert("Error saving document: " + (response.error || "Unknown error"));
                }
            });
        } catch (err) {
            alert("Error processing document: " + err.message);
        }
    });
})();
