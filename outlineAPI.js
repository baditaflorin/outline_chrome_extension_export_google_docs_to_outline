// outlineAPI.js
class OutlineAPI {
    constructor(baseUrl, apiToken) {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
        this.apiToken = apiToken;
    }

    /**
     * Centralized request helper.
     * Automatically attaches the Authorization header and JSON Content-Type (if needed),
     * checks for errors, and returns the parsed JSON response.
     *
     * @param {string} endpoint - The full URL to fetch.
     * @param {Object} options - The fetch options.
     * @returns {Promise<Object>} The parsed JSON response.
     */
    async _request(endpoint, options = {}) {
        // Merge in any existing headers, or create an empty object.
        const headers = options.headers || {};

        // Automatically attach the Authorization header.
        if (!headers["Authorization"]) {
            headers["Authorization"] = `Bearer ${this.apiToken}`;
        }

        // If a body exists and it's not FormData, ensure the Content-Type header is set.
        if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
            headers["Content-Type"] = "application/json";
        }

        const fetchOptions = { ...options, headers };

        const response = await fetch(endpoint, fetchOptions);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Request failed. Status: ${response.status}, Error: ${errorText}`);
            throw new Error(`Outline API error: ${response.status} - ${errorText}`);
        }
        return await response.json();
    }

    async createCollection(collectionName) {
        const endpoint = `${this.baseUrl}/api/collections.create`;
        console.log(`Creating collection with name: "${collectionName}" at endpoint: ${endpoint}`);
        const payload = {
            name: collectionName,
            description: "",
            permission: "read",
            color: "#123123",
            private: false
        };

        const result = await this._request(endpoint, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        console.log(`Collection created successfully: ${JSON.stringify(result)}`);
        return result.data.id;
    }

    async createDocument({ title, text, collectionId, publish = true, parentDocumentId = null }) {
        const endpoint = `${this.baseUrl}/api/documents.create`;
        const payload = { title, text, collectionId, publish };
        if (parentDocumentId && parentDocumentId.trim() !== "") {
            payload.parentDocumentId = parentDocumentId;
        }
        console.log(`Creating document with payload: ${JSON.stringify(payload)}`);
        const result = await this._request(endpoint, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        console.log(`Document created successfully: ${JSON.stringify(result)}`);
        return result;
    }

    async importDocument({ collectionId, file, parentDocumentId = "", template = false, publish = true }) {
        const endpoint = `${this.baseUrl}/api/documents.import`;
        const formData = new FormData();
        formData.append("file", file);
        formData.append("collectionId", collectionId);
        if (parentDocumentId && parentDocumentId.trim() !== "") {
            formData.append("parentDocumentId", parentDocumentId);
        }
        formData.append("template", template.toString());
        formData.append("publish", publish.toString());

        console.log(`Importing document with collectionId: ${collectionId}`);
        const result = await this._request(endpoint, {
            method: "POST",
            body: formData // No manual Content-Type header for FormData.
        });
        console.log(`Document imported successfully: ${JSON.stringify(result)}`);
        return result;
    }

    async updateDocument({ id, title = "", text, append = false, publish = true, done = false }) {
        const endpoint = `${this.baseUrl}/api/documents.update`;
        const payload = { id, title, text, append, publish, done };
        console.log(`Updating document ${id} with payload: ${JSON.stringify(payload)}`);
        const result = await this._request(endpoint, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        console.log(`Document ${id} updated successfully: ${JSON.stringify(result)}`);
        return result;
    }

    async getDocument(id) {
        const endpoint = `${this.baseUrl}/api/documents.info`;
        console.log(`Fetching document info for id: ${id}`);
        const result = await this._request(endpoint, {
            method: "POST",
            body: JSON.stringify({ id })
        });
        console.log(`Fetched document info: ${JSON.stringify(result)}`);
        return result;
    }

    async getCollection(collectionId) {
        console.log(`Fetching collection info for id: ${collectionId}`);
        const endpoint = `${this.baseUrl}/api/collections.info`;
        const result = await this._request(endpoint, {
            method: "POST",
            body: JSON.stringify({ id: collectionId })
        });
        console.log(`Fetched collection info: ${JSON.stringify(result)}`);

        if (result.data && result.data.deletedAt) {
            console.error(`Collection ${collectionId} is marked as deleted.`);
            throw new Error(`Collection ${collectionId} is deleted.`);
        }
        if (result.data && result.data.archivedAt) {
            console.error(`Collection ${collectionId} is archived.`);
            throw new Error(`Collection ${collectionId} is archived.`);
        }
        return result;
    }
}

export default OutlineAPI;
