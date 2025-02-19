// logger.js

const DEBUG = false

export const logger = {
    debug: (...args) => { if (DEBUG) console.debug("[DEBUG]", ...args); },
    info: (...args) => console.info("[INFO]", ...args),
    error: (...args) => console.error("[ERROR]", ...args)
};
