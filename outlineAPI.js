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
        return data.data.id; // Assuming the new collection ID is here.
    }

    async createDocument({title, text, collectionId, publish = true}) {
        const endpoint = `${this.baseUrl}/api/documents.create`;
        const payload = {title, text, collectionId, publish};
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

    async importDocument({collectionId, file, parentDocumentId = "", template = false, publish = true}) {
        const endpoint = `${this.baseUrl}/api/documents.import`;
        const formData = new FormData();
        formData.append("file", file);
        formData.append("collectionId", collectionId);
        // Only add parentDocumentId if it is provided (i.e. non-empty)
        if (parentDocumentId && parentDocumentId.trim() !== "") {
            formData.append("parentDocumentId", parentDocumentId);
        }
        formData.append("template", template.toString());
        formData.append("publish", publish.toString());

        // Debug: Log endpoint and FormData keys/values
        console.log("[DEBUG] Sending importDocument request to:", endpoint);
        for (const [key, value] of formData.entries()) {
            console.log(`[DEBUG] FormData: ${key} =`, value);
        }

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.apiToken}`
                    // Don't set Content-Type header manually when using FormData.
                },
                body: formData
            });

            console.log("[DEBUG] Received response:", response);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[DEBUG] Fetch error: ${response.status} - ${errorText}`);
                throw new Error(`Outline API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log("[DEBUG] Import document response JSON:", data);
            return data;
        } catch (error) {
            console.error("[DEBUG] Exception in importDocument:", error);
            throw error;
        }
    }
}

    export default OutlineAPI;
