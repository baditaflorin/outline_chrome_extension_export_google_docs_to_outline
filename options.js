// options.js
document.getElementById("settings-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const outlineUrl = document.getElementById("outlineUrl").value.trim();
    const apiToken = document.getElementById("apiToken").value.trim();
    // Use default values if the inputs are left empty
    const googleDocsCollectionName = document.getElementById("googleDocsCollectionName").value.trim() || "google-docs";
    const googleSheetsCollectionName = document.getElementById("googleSheetsCollectionName").value.trim() || "google-sheets";
    const enableSaveButton = document.getElementById("enableSaveButton").checked;

    if (!outlineUrl || !apiToken) {
        alert("Both API Base URL and API Token are required.");
        return;
    }

    chrome.storage.sync.set({ outlineUrl, apiToken, googleDocsCollectionName, googleSheetsCollectionName, enableSaveButton }, () => {
        alert("Settings saved!");
    });
});


document.getElementById("testConnection").addEventListener("click", async () => {
    const outlineUrl = document.getElementById("outlineUrl").value.trim();
    const apiToken = document.getElementById("apiToken").value.trim();
    const connectionStatus = document.getElementById("connectionStatus");

    if (!outlineUrl || !apiToken) {
        connectionStatus.textContent = "Please fill in both fields before testing.";
        return;
    }

    connectionStatus.textContent = "Testing connection...";

    // Remove trailing slashes and build the test endpoint URL
    const testEndpoint = `${outlineUrl.replace(/\/+$/, '')}/api/auth.info`;

    try {
        const response = await fetch(testEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiToken}`
            }
        });
        if (response.ok) {
            connectionStatus.textContent = "Connection successful!";
            connectionStatus.style.color = "green";
        } else {
            connectionStatus.textContent = `Connection failed: ${response.status} ${response.statusText}`;
            connectionStatus.style.color = "red";
        }
    } catch (err) {
        connectionStatus.textContent = "Connection error: " + err.message;
        connectionStatus.style.color = "red";
    }
});

// Load saved settings on page load
document.addEventListener("DOMContentLoaded", () => {
    chrome.storage.sync.get(
        ["outlineUrl", "apiToken", "googleDocsCollectionName", "googleSheetsCollectionName", "enableSaveButton"],
        (result) => {
            if (result.outlineUrl) {
                document.getElementById("outlineUrl").value = result.outlineUrl;
            }
            if (result.apiToken) {
                document.getElementById("apiToken").value = result.apiToken;
            }
            if (result.googleDocsCollectionName) {
                document.getElementById("googleDocsCollectionName").value = result.googleDocsCollectionName;
            }
            if (result.googleSheetsCollectionName) {
                document.getElementById("googleSheetsCollectionName").value = result.googleSheetsCollectionName;
            }
            // Set the checkbox state (default to true if not set)
            document.getElementById("enableSaveButton").checked = result.enableSaveButton !== false;
        }
    );
});
