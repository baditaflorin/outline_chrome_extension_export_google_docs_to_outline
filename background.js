// background.js
import OutlineAPI from './outlineAPI.js';

/**
 * Promise-based helper to get items from chrome.storage.local.
 * @param {string|string[]} key
 * @returns {Promise<Object>}
 */
function getLocalStorage(key) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(key, (result) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(result);
            }
        });
    });
}

/**
 * Promise-based helper to set items in chrome.storage.local.
 * @param {Object} obj
 * @returns {Promise<void>}
 */
function setLocalStorage(obj) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set(obj, () => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve();
            }
        });
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "saveGoogleDoc") {
        // Get Outline settings from chrome.storage.sync
        chrome.storage.sync.get(["outlineUrl", "apiToken"], async (result) => {
            const { outlineUrl, apiToken } = result;
            if (!outlineUrl || !apiToken) {
                sendResponse({ success: false, error: "Outline settings not configured. Please update options." });
                return;
            }
            try {
                const api = new OutlineAPI(outlineUrl, apiToken);

                // Retrieve the stored collectionId for "google-docs"
                let { collectionId } = await getLocalStorage("collectionId");

                // If not found, create a new collection named "google-docs" and save it.
                if (!collectionId) {
                    collectionId = await api.createCollection("google-docs");
                    await setLocalStorage({ collectionId });
                }

                // Create the document on Outline using the collectionId.
                const res = await api.createDocument({
                    title: request.title,
                    text: request.content,
                    collectionId,  // required for publishing
                    publish: true
                });

                // Assume the API returns a URL in res.data.url; adjust as needed.
                const docUrl = (res.data && res.data.url) ? res.data.url : "";
                sendResponse({ success: true, url: docUrl });
            } catch (err) {
                sendResponse({ success: false, error: err.message });
            }
        });
        return true; // Keep the message channel open for the async response.
    }
});
