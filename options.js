// options.js
document.getElementById("settings-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const outlineUrl = document.getElementById("outlineUrl").value.trim();
    const apiToken = document.getElementById("apiToken").value.trim();
    // Get the toggle value; if checked, we store true, else false.
    const enableSaveButton = document.getElementById("enableSaveButton").checked;

    if (!outlineUrl || !apiToken) {
        alert("Both API Base URL and API Token are required.");
        return;
    }

    chrome.storage.sync.set({ outlineUrl, apiToken, enableSaveButton }, () => {
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
    chrome.storage.sync.get(["outlineUrl", "apiToken", "enableSaveButton"], (result) => {
        if (result.outlineUrl) {
            document.getElementById("outlineUrl").value = result.outlineUrl;
        }
        if (result.apiToken) {
            document.getElementById("apiToken").value = result.apiToken;
        }
        // Set the checkbox state (default to true if not set)
        document.getElementById("enableSaveButton").checked =
            result.enableSaveButton !== false;
    });
});
