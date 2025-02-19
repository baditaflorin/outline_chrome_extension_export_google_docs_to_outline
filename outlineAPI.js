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
     * **Change 5:** Implements exponential backoff for retries
     *
     * @param {string} endpoint - The full URL to fetch.
     * @param {Object} options - The fetch options.
     *   - retry {number} (optional): Number of retry attempts on error.
     *   - retryDelay {number} (optional): Initial delay between retries in ms (default is 500ms).
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
        const maxAttempts = retry + 1; // Original attempt plus retries

        while (attempts < maxAttempts) {
            try {
                attempts++;
                const response = await fetch(endpoint, fetchOptions);

                // Check for HTTP errors
                if (!response.ok) {
                    const errorText = await response.text();
                    const statusCode = response.status;
                    console.error(`[ERROR] Request failed. Status: ${statusCode}, Error: ${errorText}`);

                    // Don't retry client errors (4xx), only server errors (5xx)
                    if (statusCode >= 400 && statusCode < 500) {
                        if (statusCode === 401 || statusCode === 403) {
                            throw new Error(`Authentication error (${statusCode}): ${errorText}`);
                        } else if (statusCode === 404) {
                            throw new Error(`Resource not found (404): ${errorText}`);
                        } else if (statusCode === 429) {
                            // Rate limiting - special case that should retry with backoff
                            if (attempts < maxAttempts) {
                                // Exponential backoff for rate limiting
                                const backoffDelay = retryDelay * Math.pow(2, attempts - 1);
                                console.warn(`[WARNING] Rate limited. Retrying in ${backoffDelay}ms...`);
                                await new Promise(resolve => setTimeout(resolve, backoffDelay));
                                continue;
                            }
                        }
                        throw new Error(`API error (${statusCode}): ${errorText}`);
                    }

                    // For server errors, retry if we have attempts left
                    if (attempts < maxAttempts) {
                        // Calculate exponential backoff with jitter
                        const baseDelay = retryDelay * Math.pow(2, attempts - 1);
                        // Add random jitter (±20%)
                        const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
                        const delayWithJitter = Math.max(0, Math.floor(baseDelay + jitter));

                        console.warn(`[WARNING] Server error (${statusCode}). Retry ${attempts}/${retry} in ${delayWithJitter}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delayWithJitter));
                        continue;
                    }

                    throw new Error(`Outline API error: ${response.status} - ${errorText}`);
                }

                // Success response - parse JSON
                try {
                    const json = await response.json();
                    console.debug(`[RESPONSE]`, json);
                    return json;
                } catch (jsonError) {
                    console.error(`[ERROR] Failed to parse JSON response:`, jsonError);
                    throw new Error(`Invalid JSON response: ${jsonError.message}`);
                }
            } catch (error) {
                // Handle AbortError specifically
                if (error.name === 'AbortError') {
                    console.info('[INFO] Request was cancelled by user');
                    throw new Error('Request cancelled');
                }

                // Handle network errors (offline, connection refused, etc.)
                if (error.name === 'TypeError' && error.message.includes('network')) {
                    if (attempts < maxAttempts) {
                        // Use exponential backoff for network errors too
                        const backoffDelay = retryDelay * Math.pow(2, attempts - 1);
                        const jitter = backoffDelay * 0.2 * (Math.random() * 2 - 1);
                        const delayWithJitter = Math.max(0, Math.floor(backoffDelay + jitter));

                        console.warn(`[WARNING] Network error: ${error.message}. Retrying in ${delayWithJitter}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delayWithJitter));
                        continue;
                    }
                    throw new Error(`Network error: ${error.message}. Please check your internet connection.`);
                }

                // For other errors, retry if we have attempts left
                if (attempts < maxAttempts && !error.message.includes('Authentication error') &&
                    !error.message.includes('Resource not found')) {
                    // Use exponential backoff for all retryable errors
                    const backoffDelay = retryDelay * Math.pow(2, attempts - 1);
                    const jitter = backoffDelay * 0.2 * (Math.random() * 2 - 1);
                    const delayWithJitter = Math.max(0, Math.floor(backoffDelay + jitter));

                    console.warn(
                        `[WARNING] Request failed (attempt ${attempts}/${maxAttempts}): ${error.message}. Retrying in ${delayWithJitter}ms...`
                    );
                    await new Promise(resolve => setTimeout(resolve, delayWithJitter));
                    continue;
                }

                // No more retries or non-retryable error
                throw error;
            }
        }
    }

    /**
     * Creates a new collection
     * @param {string} collectionName - The name for the new collection
     * @returns {Promise<string>} The ID of the created collection
     */
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

        try {
            const result = await this._request(endpoint, {
                method: "POST",
                body: JSON.stringify(payload),
                retry: 3,
                retryDelay: 1000
            });
            console.log(`Collection created successfully: ${JSON.stringify(result)}`);
            return result.data.id;
        } catch (error) {
            console.error(`Failed to create collection: ${error.message}`);
            throw new Error(`Failed to create collection: ${error.message}`);
        }
    }

    /**
     * Creates a new document in the specified collection
     * @param {Object} params - Document creation parameters
     * @returns {Promise<Object>} Creation result with document data
     */
    async createDocument({ title, text, collectionId, publish = true, parentDocumentId = null }) {
        const endpoint = `${this.baseUrl}/api/documents.create`;
        const payload = { title, text, collectionId, publish };
        if (parentDocumentId && parentDocumentId.trim() !== "") {
            payload.parentDocumentId = parentDocumentId;
        }
        console.log(`Creating document with payload: ${JSON.stringify(payload)}`);

        try {
            const result = await this._request(endpoint, {
                method: "POST",
                body: JSON.stringify(payload),
                retry: 2,
                retryDelay: 1000
            });
            console.log(`Document created successfully: ${JSON.stringify(result)}`);
            return result;
        } catch (error) {
            console.error(`Failed to create document: ${error.message}`);
            throw new Error(`Failed to create document: ${error.message}`);
        }
    }

    /**
     * Imports a document from a file
     * @param {Object} params - Import parameters including file and collection
     * @returns {Promise<Object>} Import result with document data
     */
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
        try {
            const result = await this._request(endpoint, {
                method: "POST",
                body: formData, // Do not set Content-Type header for FormData.
                retry: 2,
                retryDelay: 1000
            });
            console.log(`Document imported successfully: ${JSON.stringify(result)}`);
            return result;
        } catch (error) {
            console.error(`Failed to import document: ${error.message}`);
            throw new Error(`Failed to import document: ${error.message}`);
        }
    }

    /**
     * Updates an existing document
     * @param {Object} params - Update parameters
     * @returns {Promise<Object>} Update result
     */
    async updateDocument({ id, title = "", text, append = false, publish = true, done = false }) {
        const endpoint = `${this.baseUrl}/api/documents.update`;
        const payload = { id, title, text, append, publish, done };
        console.log(`Updating document ${id} with payload: ${JSON.stringify(payload)}`);

        try {
            const result = await this._request(endpoint, {
                method: "POST",
                body: JSON.stringify(payload),
                retry: 2,
                retryDelay: 1000
            });
            console.log(`Document ${id} updated successfully: ${JSON.stringify(result)}`);
            return result;
        } catch (error) {
            console.error(`Failed to update document ${id}: ${error.message}`);
            throw new Error(`Failed to update document: ${error.message}`);
        }
    }

    /**
     * Gets document information
     * @param {string} id - Document ID
     * @returns {Promise<Object>} Document data
     */
    async getDocument(id) {
        const endpoint = `${this.baseUrl}/api/documents.info`;
        console.log(`Fetching document info for id: ${id}`);

        try {
            const result = await this._request(endpoint, {
                method: "POST",
                body: JSON.stringify({ id }),
                retry: 2,
                retryDelay: 1000
            });
            console.log(`Fetched document info: ${JSON.stringify(result)}`);
            return result;
        } catch (error) {
            console.error(`Failed to get document ${id}: ${error.message}`);
            throw new Error(`Failed to get document: ${error.message}`);
        }
    }

    /**
     * Gets collection information and validates it's active
     * @param {string} collectionId - Collection ID
     * @returns {Promise<Object>} Collection data
     */
    async getCollection(collectionId) {
        console.log(`Fetching collection info for id: ${collectionId}`);
        const endpoint = `${this.baseUrl}/api/collections.info`;

        try {
            const result = await this._request(endpoint, {
                method: "POST",
                body: JSON.stringify({ id: collectionId }),
                retry: 2,
                retryDelay: 1000
            });
            console.log(`Fetched collection info: ${JSON.stringify(result)}`);

            if (!result.data) {
                throw new Error(`Invalid collection response for ${collectionId}`);
            }

            if (result.data.deletedAt) {
                console.error(`Collection ${collectionId} is marked as deleted.`);
                throw new Error(`Collection ${collectionId} is deleted.`);
            }

            if (result.data.archivedAt) {
                console.error(`Collection ${collectionId} is archived.`);
                throw new Error(`Collection ${collectionId} is archived.`);
            }

            return result;
        } catch (error) {
            console.error(`Failed to get collection ${collectionId}: ${error.message}`);
            throw new Error(`Failed to get collection: ${error.message}`);
        }
    }
}

export default OutlineAPI;