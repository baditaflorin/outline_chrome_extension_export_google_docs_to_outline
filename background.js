// background.js
import OutlineAPI from './outlineAPI.js';
import { appendHeaderToDocument } from './headerUpdateHelper.js';

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

/**
 * Promise-based helper to get items from chrome.storage.sync.
 * @param {string|string[]} key
 * @returns {Promise<Object>}
 */
function getSyncStorage(key) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(key, (result) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(result);
            }
        });
    });
}

/**
 * Helper function to retrieve Outline config and execute a callback.
 * @param {Function} sendResponse
 * @param {Function} callback - async function(outlineUrl, apiToken)
 */
async function withOutlineConfig(sendResponse, callback) {
    try {
        const { outlineUrl, apiToken } = await getSyncStorage(["outlineUrl", "apiToken"]);
        if (!outlineUrl || !apiToken) {
            sendResponse({ success: false, error: "Outline settings not configured. Please update options." });
            return;
        }
        await callback(outlineUrl, apiToken);
    } catch (err) {
        console.error("withOutlineConfig error:", err);
        sendResponse({ success: false, error: err.message });
    }
}

/**
 * Helper function to get or create a collection.
 * If a collection ID is stored locally, we verify it still exists via the Outline API.
 * If it doesn't (or if no ID is stored), we create a new collection.
 * @param {OutlineAPI} api
 * @param {string} storageKey - key used in chrome.storage.local
 * @param {string} collectionName
 * @returns {Promise<string>} collectionId
 */
async function getOrCreateCollection(api, storageKey, collectionName) {
    console.log(`Attempting to retrieve stored collection for key "${storageKey}"...`);
    const stored = await getLocalStorage(storageKey);
    let collectionId = stored[storageKey];

    if (collectionId) {
        console.log(`Found stored collection id: ${collectionId}. Verifying its existence...`);
        try {
            const collectionInfo = await api.getCollection(collectionId);
            console.log(`Collection verified: ${JSON.stringify(collectionInfo)}`);
        } catch (err) {
            console.error(`Verification failed for collection ${collectionId}: ${err.message}`);
            console.log(`Creating new collection "${collectionName}"...`);
            collectionId = await api.createCollection(collectionName);
            console.log(`New collection created: ${collectionId}. Saving to local storage.`);
            await setLocalStorage({ [storageKey]: collectionId });
        }
    } else {
        console.log(`No collection id found for key "${storageKey}". Creating new collection "${collectionName}"...`);
        collectionId = await api.createCollection(collectionName);
        console.log(`New collection created: ${collectionId}. Saving to local storage.`);
        await setLocalStorage({ [storageKey]: collectionId });
    }
    return collectionId;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "saveGoogleDoc") {
        withOutlineConfig(sendResponse, async (outlineUrl, apiToken) => {
            try {
                const api = new OutlineAPI(outlineUrl, apiToken);
                const collectionId = await getOrCreateCollection(api, "collectionId", "google-docs");
                console.log(`Using collectionId: ${collectionId} for document creation.`);

                // Create the document on Outline.
                const res = await api.createDocument({
                    title: request.title,
                    text: request.content,
                    collectionId,
                    publish: true
                });
                console.log(`Document creation response: ${JSON.stringify(res)}`);

                const docId = res.data && res.data.id;
                const docUrl = docId ? `${outlineUrl}/doc/${docId}` : "";

                // Optionally, update the document with the header.
                if (docId && request.headerMarkdown) {
                    const headerPosition = request.headerPosition || 'top';
                    await appendHeaderToDocument(
                        outlineUrl,
                        apiToken,
                        docId,
                        request.headerMarkdown,
                        headerPosition
                    );
                }
                sendResponse({ success: true, url: docUrl });
            } catch (err) {
                console.error("Error in saveGoogleDoc action:", err);
                sendResponse({ success: false, error: err.message });
            }
        });
        return true;
    } else if (request.action === "importGoogleSheet") {
        withOutlineConfig(sendResponse, async (outlineUrl, apiToken) => {
            try {
                const api = new OutlineAPI(outlineUrl, apiToken);
                const collectionId = await getOrCreateCollection(api, "collectionId_sheet", "google-sheets");
                console.log(`Using collectionId: ${collectionId} for sheet import.`);

                // Create a File object from the TSV content.
                const fileContent = request.fileContent;
                const fileBlob = new Blob([fileContent], { type: "text/csv" });
                const fileObj = new File([fileBlob], "import.csv", { type: "text/csv" });

                const res = await api.importDocument({
                    collectionId,
                    file: fileObj,
                    publish: true
                });
                console.log(`Import document response: ${JSON.stringify(res)}`);

                const docId = res.data && res.data.id;
                const docUrl = docId ? `${outlineUrl}/doc/${docId}` : "";

                // Update the document's title if provided.
                if (docId && request.title) {
                    const docInfo = await api.getDocument(docId);
                    const currentText = (docInfo.data && docInfo.data.text) || "";
                    await api.updateDocument({
                        id: docId,
                        title: request.title,
                        text: currentText,
                        append: false,
                        publish: true,
                        done: true
                    });
                }

                if (docId && request.headerMarkdown) {
                    const headerPosition = request.headerPosition || 'top';
                    await appendHeaderToDocument(
                        outlineUrl,
                        apiToken,
                        docId,
                        request.headerMarkdown,
                        headerPosition
                    );
                }
                sendResponse({ success: true, url: docUrl });
            } catch (err) {
                console.error("Error in importGoogleSheet action:", err);
                sendResponse({ success: false, error: err.message });
            }
        });
        return true;
    } else if (request.action === "appendHeader") {
        withOutlineConfig(sendResponse, async (outlineUrl, apiToken) => {
            try {
                const headerPosition = request.headerPosition || 'top';
                const res = await appendHeaderToDocument(
                    outlineUrl,
                    apiToken,
                    request.docId,
                    request.headerMarkdown,
                    headerPosition
                );
                sendResponse({ success: true, result: res });
            } catch (err) {
                console.error("Error in appendHeader action:", err);
                sendResponse({ success: false, error: err.message });
            }
        });
        return true;
    }
});
