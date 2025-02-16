// outlineAPI.js
class OutlineAPI {
    constructor(baseUrl, apiToken) {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
        this.apiToken = apiToken;
    }

    async createCollection(collectionName) {
        const endpoint = `${this.baseUrl}/api/collections.create`;
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
            throw new Error(`Outline API error: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        return data.data.id;
    }

    async createDocument({ title, text, collectionId, publish = true }) {
        const endpoint = `${this.baseUrl}/api/documents.create`;
        const payload = { title, text, collectionId, publish };
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
            throw new Error(`Outline API error: ${response.status} - ${errorText}`);
        }
        return await response.json();
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

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.apiToken}`
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Outline API error: ${response.status} - ${errorText}`);
        }
        return await response.json();
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
            throw new Error(`Outline API error: ${response.status} - ${errorText}`);
        }
        return await response.json();
    }

    // New helper to fetch the current document content.
    async getDocument(id) {
        const endpoint = `${this.baseUrl}/api/documents.info`;
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
            throw new Error(`Outline API error: ${response.status} - ${errorText}`);
        }
        return await response.json();
    }
}

export default OutlineAPI;
