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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "saveGoogleDoc") {
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
                if (!collectionId) {
                    collectionId = await api.createCollection("google-docs");
                    await setLocalStorage({ collectionId });
                }

                // Create the document on Outline.
                const res = await api.createDocument({
                    title: request.title,
                    text: request.content,
                    collectionId,
                    publish: true
                });

                const docId = res.data && res.data.id;
                const docUrl = docId ? `${outlineUrl}/doc/${docId}` : "";

                // Optionally, update the document with the header.
                if (docId && request.headerMarkdown) {
                    // Use headerPosition from request if provided; default to 'top'
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
                sendResponse({ success: false, error: err.message });
            }
        });
        return true; // Keep the channel open for async response.
    } else if (request.action === "importGoogleSheet") {
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

                // Create a File object from the TSV content.
                const fileContent = request.fileContent;
                const fileBlob = new Blob([fileContent], { type: "text/csv" });
                // Note: originally the file was named "import.csv". We now ignore that file name.
                // The Outline document’s title will be set using the title parameter from the request.
                const fileObj = new File([fileBlob], "import.csv", { type: "text/csv" });

                const res = await api.importDocument({
                    collectionId: collectionId_sheet,
                    file: fileObj,
                    publish: true
                });

                const docId = res.data && res.data.id;
                const docUrl = docId ? `${outlineUrl}/doc/${docId}` : "";

                // NEW: Update the document's title if provided.
                if (docId && request.title) {
                    const docInfo = await api.getDocument(docId);
                    const currentText = (docInfo.data && docInfo.data.text) || "";
                    await api.updateDocument({
                        id: docId,
                        title: request.title, // Use the dynamic title from the request
                        text: currentText,    // Preserve existing content
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
                sendResponse({ success: false, error: err.message });
            }
        });
        return true;
    }
    else if (request.action === "appendHeader") {
        chrome.storage.sync.get(["outlineUrl", "apiToken"], async (result) => {
            const { outlineUrl, apiToken } = result;
            if (!outlineUrl || !apiToken) {
                sendResponse({ success: false, error: "Outline settings not configured. Please update options." });
                return;
            }
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
                sendResponse({ success: false, error: err.message });
            }
        });
        return true;
    }
});
