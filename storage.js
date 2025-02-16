// storage.js

/**
 * Promise-based helper to get items from chrome.storage.local.
 * @param {string|string[]} key
 * @returns {Promise<Object>}
 */
export function getLocalStorage(key) {
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
export function setLocalStorage(obj) {
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
export function getSyncStorage(key) {
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
