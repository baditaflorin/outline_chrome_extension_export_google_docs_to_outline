// headerUpdateHelper.js
import OutlineAPI from './outlineAPI.js';

export async function appendHeaderToDocument(
    outlineUrl,
    apiToken,
    docId,
    headerMarkdown,
    position = 'bottom' // "top" to prepend, "bottom" to append
) {
    const api = new OutlineAPI(outlineUrl, apiToken);
    try {
        // Always fetch current document info to preserve the title
        const docInfo = await api.getDocument(docId);
        const currentText = (docInfo.data && docInfo.data.text) || "";
        const currentTitle = (docInfo.data && docInfo.data.title) || "";

        if (position === 'top') {
            const newText = `${headerMarkdown}\n\n${currentText}`;
            const result = await api.updateDocument({
                id: docId,
                title: currentTitle, // Preserve title
                text: newText,
                append: false,
                publish: true,
                done: true
            });
            return result;
        } else {
            // For bottom, still preserve the title.
            const result = await api.updateDocument({
                id: docId,
                title: currentTitle,
                text: headerMarkdown,
                append: true,
                publish: true,
                done: true
            });
            return result;
        }
    } catch (err) {
        console.error("Failed to update document:", err);
        throw err;
    }
}

