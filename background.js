// background.js
import OutlineAPI from './outlineAPI.js';
import { appendHeaderToDocument } from './headerUpdateHelper.js';
import { logger } from './logger.js';
import { getLocalStorage, setLocalStorage, getSyncStorage } from './storage.js';

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
        logger.error("withOutlineConfig error:", err);
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
    logger.info(`Attempting to retrieve stored collection for key "${storageKey}"...`);
    const stored = await getLocalStorage(storageKey);
    let collectionId = stored[storageKey];

    if (collectionId) {
        logger.info(`Found stored collection id: ${collectionId}. Verifying its existence...`);
        try {
            const collectionInfo = await api.getCollection(collectionId);
            logger.info(`Collection verified: ${JSON.stringify(collectionInfo)}`);
        } catch (err) {
            logger.error(`Verification failed for collection ${collectionId}: ${err.message}`);
            logger.info(`Creating new collection "${collectionName}"...`);
            collectionId = await api.createCollection(collectionName);
            logger.info(`New collection created: ${collectionId}. Saving to local storage.`);
            await setLocalStorage({ [storageKey]: collectionId });
        }
    } else {
        logger.info(`No collection id found for key "${storageKey}". Creating new collection "${collectionName}"...`);
        collectionId = await api.createCollection(collectionName);
        logger.info(`New collection created: ${collectionId}. Saving to local storage.`);
        await setLocalStorage({ [storageKey]: collectionId });
    }
    return collectionId;
}

/**
 * Map of action names to handler functions.
 * Each handler receives (request, sendResponse, outlineUrl, apiToken).
 */
const actions = {
    "saveGoogleDoc": async (request, sendResponse, outlineUrl, apiToken) => {
        try {
            const api = new OutlineAPI(outlineUrl, apiToken);
            const collectionId = await getOrCreateCollection(api, "collectionId", "google-docs");
            logger.info(`Using collectionId: ${collectionId} for document creation.`);

            const res = await api.createDocument({
                title: request.title,
                text: request.content,
                collectionId,
                publish: true
            });
            logger.info(`Document creation response: ${JSON.stringify(res)}`);

            const docId = res.data && res.data.id;
            const docUrl = docId ? `${outlineUrl}/doc/${docId}` : "";

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
            logger.error("Error in saveGoogleDoc action:", err);
            sendResponse({ success: false, error: err.message });
        }
    },
    "importGoogleSheet": async (request, sendResponse, outlineUrl, apiToken) => {
        try {
            const api = new OutlineAPI(outlineUrl, apiToken);
            const collectionId = await getOrCreateCollection(api, "collectionId_sheet", "google-sheets");
            logger.info(`Using collectionId: ${collectionId} for sheet import.`);

            const fileContent = request.fileContent;
            const fileBlob = new Blob([fileContent], { type: "text/csv" });
            const fileObj = new File([fileBlob], "import.csv", { type: "text/csv" });

            const res = await api.importDocument({
                collectionId,
                file: fileObj,
                publish: true
            });
            logger.info(`Import document response: ${JSON.stringify(res)}`);

            const docId = res.data && res.data.id;
            const docUrl = docId ? `${outlineUrl}/doc/${docId}` : "";

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
            logger.error("Error in importGoogleSheet action:", err);
            sendResponse({ success: false, error: err.message });
        }
    },
    "appendHeader": async (request, sendResponse, outlineUrl, apiToken) => {
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
            logger.error("Error in appendHeader action:", err);
            sendResponse({ success: false, error: err.message });
        }
    }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    withOutlineConfig(sendResponse, async (outlineUrl, apiToken) => {
        if (actions.hasOwnProperty(request.action)) {
            try {
                await actions[request.action](request, sendResponse, outlineUrl, apiToken);
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        } else {
            sendResponse({ success: false, error: "Unknown action" });
        }
    });
    return true;
});
