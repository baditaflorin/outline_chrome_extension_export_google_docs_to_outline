// logger.js
export const logger = {
    debug: (...args) => console.debug("[DEBUG]", ...args),
    info: (...args) => console.info("[INFO]", ...args),
    error: (...args) => console.error("[ERROR]", ...args)
};
