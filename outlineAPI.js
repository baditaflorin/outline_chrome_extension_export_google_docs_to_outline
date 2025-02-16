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
        return data.data.id;  // Assuming the new collection ID is here.
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
}

export default OutlineAPI;
