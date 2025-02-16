// background.js
import OutlineAPI from './outlineAPI.js';
import { appendHeaderToDocument } from './headerUpdateHelper.js';
import { logger } from './logger.js';
import { getLocalStorage, setLocalStorage, getSyncStorage } from './storage.js';

/* --- Change 3: Cache the configuration values --- */
let cachedConfig = null;

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync') {
        if (
            changes.outlineUrl ||
            changes.apiToken ||
            changes.googleDocsCollectionName ||
            changes.googleSheetsCollectionName
        ) {
            cachedConfig = null;
            // Optionally clear locally stored collection IDs so they are re-created with the new settings.
            chrome.storage.local.remove(["collectionId", "collectionId_sheet"], () => {
                logger.info("Cleared cached collection IDs due to config change.");
            });
        }
    }
});

async function withOutlineConfig(sendResponse, callback) {
    try {
        if (!cachedConfig) {
            const { outlineUrl, apiToken, googleDocsCollectionName, googleSheetsCollectionName } = await getSyncStorage([
                "outlineUrl",
                "apiToken",
                "googleDocsCollectionName",
                "googleSheetsCollectionName"
            ]);
            if (!outlineUrl || !apiToken) {
                sendResponse({ success: false, error: "Outline settings not configured. Please update options." });
                return;
            }
            cachedConfig = {
                outlineUrl,
                apiToken,
                googleDocsCollectionName: googleDocsCollectionName || "google-docs",
                googleSheetsCollectionName: googleSheetsCollectionName || "google-sheets"
            };
        }
        // Pass the new config values to the callback.
        await callback(
            cachedConfig.outlineUrl,
            cachedConfig.apiToken,
            cachedConfig.googleDocsCollectionName,
            cachedConfig.googleSheetsCollectionName
        );
    } catch (err) {
        logger.error("withOutlineConfig error:", err);
        sendResponse({ success: false, error: err.message });
    }
}


/* --- Change 2: Unified error response helper --- */
function respondWithError(sendResponse, error) {
    logger.error("Responding with error:", error);
    sendResponse({ success: false, error: error.message || error });
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
    "saveGoogleDoc": async (request, sendResponse, outlineUrl, apiToken, googleDocsCollectionName) => {
        try {
            const api = new OutlineAPI(outlineUrl, apiToken);
            // Use the configured Google Docs collection name
            const collectionId = await getOrCreateCollection(api, "collectionId", googleDocsCollectionName);
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
            respondWithError(sendResponse, err);
        }
    },
    "importGoogleSheet": async (request, sendResponse, outlineUrl, apiToken, _unused, googleSheetsCollectionName) => {
        try {
            const api = new OutlineAPI(outlineUrl, apiToken);
            // Use the configured Google Sheets collection name
            const collectionId = await getOrCreateCollection(api, "collectionId_sheet", googleSheetsCollectionName);
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
            respondWithError(sendResponse, err);
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
            respondWithError(sendResponse, err);
        }
    }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    withOutlineConfig(sendResponse, async (outlineUrl, apiToken, googleDocsCollectionName, googleSheetsCollectionName) => {
        if (actions.hasOwnProperty(request.action)) {
            try {
                // Pass the extra parameters based on the action
                if (request.action === "saveGoogleDoc") {
                    await actions[request.action](request, sendResponse, outlineUrl, apiToken, googleDocsCollectionName);
                } else if (request.action === "importGoogleSheet") {
                    await actions[request.action](request, sendResponse, outlineUrl, apiToken, googleDocsCollectionName, googleSheetsCollectionName);
                } else {
                    await actions[request.action](request, sendResponse, outlineUrl, apiToken);
                }
            } catch (error) {
                respondWithError(sendResponse, error);
            }
        } else {
            sendResponse({ success: false, error: "Unknown action" });
        }
    });
    return true;
});
