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
        // Existing Google Docs save logic (unchanged)
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

                // Construct the correct Outline document URL using the returned document ID.
                const docId = res.data && res.data.id;
                const docUrl = docId ? `${outlineUrl}/doc/${docId}` : "";
                sendResponse({ success: true, url: docUrl });
            } catch (err) {
                sendResponse({ success: false, error: err.message });
            }
        });
        return true; // Keep the message channel open for async response.
    } else if (request.action === "importGoogleSheet") {
        // New branch for Google Sheets import
        chrome.storage.sync.get(["outlineUrl", "apiToken"], async (result) => {
            const { outlineUrl, apiToken } = result;
            if (!outlineUrl || !apiToken) {
                sendResponse({ success: false, error: "Outline settings not configured. Please update options." });
                return;
            }
            try {
                const api = new OutlineAPI(outlineUrl, apiToken);

                // Retrieve the stored collectionId for "google-sheets"
                let { collectionId_sheet } = await getLocalStorage("collectionId_sheet");
                if (!collectionId_sheet) {
                    collectionId_sheet = await api.createCollection("google-sheets");
                    await setLocalStorage({ collectionId_sheet });
                }

                // The request sends fileContent as plain text (exported as TSV)
                const fileContent = request.fileContent;
                // Create a Blob and then a File object with a .csv extension.
                const fileBlob = new Blob([fileContent], { type: "text/csv" });
                const fileObj = new File([fileBlob], "import.csv", { type: "text/csv" });

                // Omit parentDocumentId so the document is added at the collection root.
                const res = await api.importDocument({
                    collectionId: collectionId_sheet,
                    file: fileObj,
                    publish: true
                });

                const docId = res.data && res.data.id;
                const docUrl = docId ? `${outlineUrl}/doc/${docId}` : "";
                sendResponse({ success: true, url: docUrl });
            } catch (err) {
                sendResponse({ success: false, error: err.message });
            }
        });
        return true;
    }

});
