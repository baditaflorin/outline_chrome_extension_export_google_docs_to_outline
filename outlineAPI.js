// outlineAPI.js
class OutlineAPI {
    constructor(baseUrl, apiToken) {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
        this.apiToken = apiToken;
    }

    /**
     * Centralized request helper.
     *
     * **Change 2:** Supports cancellation via an optional AbortController signal.
     * **Change 3:** Retries the request automatically for transient errors.
     * **Change 4:** Logs detailed request and response information.
     *
     * @param {string} endpoint - The full URL to fetch.
     * @param {Object} options - The fetch options.
     *   - retry {number} (optional): Number of retry attempts on error.
     *   - retryDelay {number} (optional): Delay between retries in ms (default is 500ms).
     *   - signal {AbortSignal} (optional): Abort signal to cancel the request.
     *   - ...rest: All other options passed to fetch.
     * @returns {Promise<Object>} The parsed JSON response.
     */
    async _request(endpoint, options = {}) {
        // Destructure custom options
        const { retry = 0, retryDelay = 500, signal, ...restOptions } = options;
        // Use existing headers or create a new object.
        let headers = restOptions.headers || {};

        // Automatically attach the Authorization header if not present.
        if (!headers["Authorization"]) {
            headers["Authorization"] = `Bearer ${this.apiToken}`;
        }

        // If a body exists and it's not FormData, ensure the Content-Type header is set.
        if (restOptions.body && !(restOptions.body instanceof FormData) && !headers["Content-Type"]) {
            headers["Content-Type"] = "application/json";
        }

        // Combine headers and pass along the signal.
        const fetchOptions = { ...restOptions, headers, signal };

        // **Change 4:** Log the request details.
        console.debug(`[REQUEST] ${fetchOptions.method || "GET"} ${endpoint}`, { headers, body: restOptions.body });

        let attempts = 0;
        while (true) {
            try {
                const response = await fetch(endpoint, fetchOptions);
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`[ERROR] Request failed. Status: ${response.status}, Error: ${errorText}`);
                    throw new Error(`Outline API error: ${response.status} - ${errorText}`);
                }
                const json = await response.json();
                console.debug(`[RESPONSE]`, json);
                return json;
            } catch (error) {
                // **Change 3:** If we have retries left, wait and then retry.
                if (attempts < retry) {
                    attempts++;
                    console.warn(
                        `[WARNING] Request failed (attempt ${attempts}): ${error.message}. Retrying in ${retryDelay}ms...`
                    );
                    await new Promise((res) => setTimeout(res, retryDelay));
                    continue;
                }
                throw error;
            }
        }
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
            // You could pass retry: 2 here if desired.
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
            body: formData // Do not set Content-Type header for FormData.
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
