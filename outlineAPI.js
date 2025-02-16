// outlineAPI.js
class OutlineAPI {
    constructor(baseUrl, apiToken) {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
        this.apiToken = apiToken;
    }

    async createCollection(collectionName) {
        const endpoint = `${this.baseUrl}/api/collections.create`;
        console.log(`Creating collection with name: "${collectionName}" at endpoint: ${endpoint}`);
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.apiToken}`
            },
            body: JSON.stringify({
                name: collectionName,
                description: "",
                permission: "read",
                color: "#123123",
                private: false
            })
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to create collection. Status: ${response.status}, Error: ${errorText}`);
            throw new Error(`Outline API error: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        console.log(`Collection created successfully: ${JSON.stringify(data)}`);
        return data.data.id;
    }

    async createDocument({ title, text, collectionId, publish = true, parentDocumentId = null }) {
        const endpoint = `${this.baseUrl}/api/documents.create`;
        // Build the payload without parentDocumentId if not provided.
        const payload = { title, text, collectionId, publish };
        if (parentDocumentId && parentDocumentId.trim() !== "") {
            payload.parentDocumentId = parentDocumentId;
        }
        console.log(`Creating document with payload: ${JSON.stringify(payload)}`);

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.apiToken}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to create document. Status: ${response.status}, Error: ${errorText}`);
            throw new Error(`Outline API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
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
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.apiToken}`
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to import document. Status: ${response.status}, Error: ${errorText}`);
            throw new Error(`Outline API error: ${response.status} - ${errorText}`);
        }
        const result = await response.json();
        console.log(`Document imported successfully: ${JSON.stringify(result)}`);
        return result;
    }

    async updateDocument({ id, title = "", text, append = false, publish = true, done = false }) {
        const endpoint = `${this.baseUrl}/api/documents.update`;
        const payload = {
            id,
            title,
            text,
            append,
            publish,
            done
        };
        console.log(`Updating document ${id} with payload: ${JSON.stringify(payload)}`);
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.apiToken}`
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to update document ${id}. Status: ${response.status}, Error: ${errorText}`);
            throw new Error(`Outline API error: ${response.status} - ${errorText}`);
        }
        const result = await response.json();
        console.log(`Document ${id} updated successfully: ${JSON.stringify(result)}`);
        return result;
    }

    // New helper to fetch the current document content.
    async getDocument(id) {
        const endpoint = `${this.baseUrl}/api/documents.info`;
        console.log(`Fetching document info for id: ${id}`);
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.apiToken}`
            },
            body: JSON.stringify({ id })
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to fetch document info for ${id}. Status: ${response.status}, Error: ${errorText}`);
            throw new Error(`Outline API error: ${response.status} - ${errorText}`);
        }
        const result = await response.json();
        console.log(`Fetched document info: ${JSON.stringify(result)}`);
        return result;
    }

    /**
     * New helper to retrieve collection information.
     * This calls the /collections.info endpoint as documented.
     * @param {string} collectionId
     * @returns {Promise<Object>}
     */
    async getCollection(collectionId) {
        console.log(`Fetching collection info for id: ${collectionId}`);
        const endpoint = `${this.baseUrl}/api/collections.info`;
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.apiToken}`
            },
            body: JSON.stringify({ id: collectionId })
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to fetch collection info for ${collectionId}. Status: ${response.status}, Error: ${errorText}`);
            throw new Error(`Outline API error: ${response.status} - ${errorText}`);
        }
        const result = await response.json();
        console.log(`Fetched collection info: ${JSON.stringify(result)}`);

        // Check if the collection is marked as deleted.
        if (result.data && result.data.deletedAt) {
            console.error(`Collection ${collectionId} is marked as deleted.`);
            throw new Error(`Collection ${collectionId} is deleted.`);
        }
        // **New Check:** If the collection is archived, treat it as invalid.
        if (result.data && result.data.archivedAt) {
            console.error(`Collection ${collectionId} is archived.`);
            throw new Error(`Collection ${collectionId} is archived.`);
        }

        return result;
    }

}

export default OutlineAPI;
