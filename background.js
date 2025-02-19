// background.js
import OutlineAPI from './outlineAPI.js';
import { appendHeaderToDocument } from './headerUpdateHelper.js';
import { logger } from './logger.js';
import { getLocalStorage, setLocalStorage, getSyncStorage } from './storage.js';

/* --- Change 3: Cache the configuration values --- */
let cachedConfig = null;
const REQUEST_TIMEOUT = 30000; // 30 seconds timeout for all requests

// Clear cache when settings change
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

/**
 * Creates an AbortController with timeout
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {AbortController} Controller that will auto-abort after timeout
 */
function createControllerWithTimeout(timeoutMs = REQUEST_TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort();
        logger.error(`Request aborted due to timeout (${timeoutMs}ms)`);
    }, timeoutMs);

    // Store the timeout ID so it can be cleared if needed
    controller.timeoutId = timeoutId;
    return controller;
}

/**
 * Clear the timeout associated with an AbortController
 * @param {AbortController} controller - The controller with a timeout
 */
function clearControllerTimeout(controller) {
    if (controller && controller.timeoutId) {
        clearTimeout(controller.timeoutId);
    }
}

/**
 * Helper function to load and validate Outline config
 * @param {Function} sendResponse - Function to send response back to caller
 * @param {Function} callback - Callback to execute with config values
 */
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
                respondWithError(sendResponse, new Error("Outline settings not configured. Please update options."));
                return;
            }

            // Validate URL format
            try {
                new URL(outlineUrl);
            } catch (err) {
                respondWithError(sendResponse, new Error("Invalid Outline URL format. Please check your settings."));
                return;
            }

            cachedConfig = {
                outlineUrl: outlineUrl.trim(),
                apiToken: apiToken.trim(),
                googleDocsCollectionName: googleDocsCollectionName?.trim() || "google-docs",
                googleSheetsCollectionName: googleSheetsCollectionName?.trim() || "google-sheets"
            };
        }

        // Pass the config values to the callback.
        await callback(
            cachedConfig.outlineUrl,
            cachedConfig.apiToken,
            cachedConfig.googleDocsCollectionName,
            cachedConfig.googleSheetsCollectionName
        );
    } catch (err) {
        logger.error("withOutlineConfig error:", err);
        respondWithError(sendResponse, err);
    }
}

/* --- Helper for error responses --- */
function respondWithError(sendResponse, error) {
    const errorMessage = error?.message || "Unknown error occurred";
    logger.error("Responding with error:", errorMessage);
    sendResponse({
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
    });
}

/**
 * Helper function to get or create a collection.
 * If a collection ID is stored locally, we verify it still exists via the Outline API.
 * If it doesn't (or if no ID is stored), we create a new collection.
 * @param {OutlineAPI} api - Outline API instance
 * @param {string} storageKey - key used in chrome.storage.local
 * @param {string} collectionName - Name for the collection
 * @returns {Promise<string>} collectionId
 */
async function getOrCreateCollection(api, storageKey, collectionName) {
    logger.info(`Attempting to retrieve stored collection for key "${storageKey}"...`);
    const stored = await getLocalStorage(storageKey);
    let collectionId = stored[storageKey];
    let isVerified = false;

    if (collectionId) {
        logger.info(`Found stored collection id: ${collectionId}. Verifying its existence...`);
        try {
            const controller = createControllerWithTimeout();
            try {
                const collectionInfo = await api.getCollection(collectionId);
                clearControllerTimeout(controller);
                logger.info(`Collection verified: ${JSON.stringify(collectionInfo)}`);
                isVerified = true;
            } catch (err) {
                clearControllerTimeout(controller);
                throw err;
            }
        } catch (err) {
            logger.error(`Verification failed for collection ${collectionId}: ${err.message}`);
            // Fall through to creation
            isVerified = false;
        }
    }

    // Create a new collection if needed
    if (!isVerified) {
        try {
            logger.info(`Creating new collection "${collectionName}"...`);
            const controller = createControllerWithTimeout();
            try {
                collectionId = await api.createCollection(collectionName);
                clearControllerTimeout(controller);
                logger.info(`New collection created: ${collectionId}. Saving to local storage.`);
                await setLocalStorage({ [storageKey]: collectionId });
            } catch (err) {
                clearControllerTimeout(controller);
                throw err;
            }
        } catch (createErr) {
            logger.error(`Failed to create collection: ${createErr.message}`);
            throw new Error(`Failed to create or access collection: ${createErr.message}`);
        }
    }

    return collectionId;
}

/**
 * Map of action names to handler functions.
 * Each handler receives (request, sendResponse, outlineUrl, apiToken).
 */
const actions = {
    "saveGoogleDoc": async (request, sendResponse, outlineUrl, apiToken, googleDocsCollectionName) => {
        const controller = createControllerWithTimeout();
        try {
            // Validate required fields
            if (!request.title || !request.content) {
                throw new Error("Missing required fields: title and content are required");
            }

            const api = new OutlineAPI(outlineUrl, apiToken);
            // Use the configured Google Docs collection name
            const collectionId = await getOrCreateCollection(api, "collectionId", googleDocsCollectionName);
            logger.info(`Using collectionId: ${collectionId} for document creation.`);

            // Create document with automatic retry
            const res = await api.createDocument({
                title: request.title,
                text: request.content,
                collectionId,
                publish: true
            });

            logger.info(`Document creation response: ${JSON.stringify(res)}`);

            const docId = res.data && res.data.id;
            if (!docId) {
                throw new Error("Failed to get document ID from API response");
            }

            const docUrl = `${outlineUrl}/doc/${docId}`;

            // Add header if provided
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

            clearControllerTimeout(controller);
            sendResponse({
                success: true,
                url: docUrl,
                documentId: docId,
                timestamp: new Date().toISOString()
            });
        } catch (err) {
            clearControllerTimeout(controller);
            respondWithError(sendResponse, err);
        }
    },

    "importGoogleSheet": async (request, sendResponse, outlineUrl, apiToken, _unused, googleSheetsCollectionName) => {
        const controller = createControllerWithTimeout();
        try {
            // Validate fileContent
            if (!request.fileContent) {
                throw new Error("Missing required field: fileContent");
            }

            const api = new OutlineAPI(outlineUrl, apiToken);
            // Use the configured Google Sheets collection name
            const collectionId = await getOrCreateCollection(api, "collectionId_sheet", googleSheetsCollectionName);
            logger.info(`Using collectionId: ${collectionId} for sheet import.`);

            // Prepare file for upload
            const fileContent = request.fileContent;
            // Validate file content is not empty
            if (!fileContent || fileContent.trim() === '') {
                throw new Error("Empty file content provided");
            }

            const fileBlob = new Blob([fileContent], { type: "text/csv" });
            // Use provided title or default name
            const fileName = (request.title || "import") + ".csv";
            const fileObj = new File([fileBlob], fileName, { type: "text/csv" });

            // Import document
            const res = await api.importDocument({
                collectionId,
                file: fileObj,
                publish: true
            });
            logger.info(`Import document response: ${JSON.stringify(res)}`);

            const docId = res.data && res.data.id;
            if (!docId) {
                throw new Error("Failed to get document ID from import response");
            }

            const docUrl = `${outlineUrl}/doc/${docId}`;

            // Update title if provided
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

            // Add header if provided
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

            clearControllerTimeout(controller);
            sendResponse({
                success: true,
                url: docUrl,
                documentId: docId,
                timestamp: new Date().toISOString()
            });
        } catch (err) {
            clearControllerTimeout(controller);
            respondWithError(sendResponse, err);
        }
    },

    "appendHeader": async (request, sendResponse, outlineUrl, apiToken) => {
        const controller = createControllerWithTimeout();
        try {
            // Validate required fields
            if (!request.docId || !request.headerMarkdown) {
                throw new Error("Missing required fields: docId and headerMarkdown");
            }

            const headerPosition = request.headerPosition || 'top';
            const res = await appendHeaderToDocument(
                outlineUrl,
                apiToken,
                request.docId,
                request.headerMarkdown,
                headerPosition
            );

            clearControllerTimeout(controller);
            sendResponse({
                success: true,
                result: res,
                timestamp: new Date().toISOString()
            });
        } catch (err) {
            clearControllerTimeout(controller);
            respondWithError(sendResponse, err);
        }
    }
};

/**
 * Message handler for extension communication
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Validate request structure
    if (!request || !request.action) {
        sendResponse({ success: false, error: "Invalid request: missing action" });
        return true;
    }

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

    // Return true to indicate we'll send the response asynchronously
    return true;
});