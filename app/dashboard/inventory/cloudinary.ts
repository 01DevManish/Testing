export const uploadToCloudinary = async (base64OrUrl: string): Promise<string> => {
    if (!base64OrUrl.startsWith("data:image")) {
        return base64OrUrl; // Already a URL or absolute path
    }

    try {
        const formData = new FormData();
        formData.append("file", base64OrUrl);

        const res = await fetch("/api/upload", {
            method: "POST",
            body: formData
        });
        
        const data = await res.json().catch(() => ({ error: "Server response was not valid JSON" }));

        if (!res.ok) {
            throw new Error(data.error || `Upload failed with status ${res.status}`);
        }
        if (!data.secure_url) {
            throw new Error("Invalid response: secure_url missing");
        }
        return data.secure_url;
    } catch (err: any) {
        console.error("Cloudinary Upload Error:", err);
        throw new Error(err.message || "Network error occurred during upload");
    }
};

/**
 * Extracts public_id from a Cloudinary URL
 * Example: https://res.cloudinary.com/demo/image/upload/v12345678/sample.jpg -> sample
 */
export const extractPublicId = (url: string): string | null => {
    if (!url || !url.includes("cloudinary.com")) return null;
    try {
        const parts = url.split("/");
        const lastPart = parts[parts.length - 1];
        // Remove extension (e.g., .jpg, .png)
        return lastPart.split(".")[0];
    } catch (err) {
        return null;
    }
};

export const deleteFromCloudinary = async (imageUrl: string): Promise<boolean> => {
    const publicId = extractPublicId(imageUrl);
    if (!publicId) return false;

    try {
        const res = await fetch("/api/delete-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ public_id: publicId })
        });
        const data = await res.json();
        return data.result === "ok";
    } catch (err) {
        console.error("Cloudinary Delete Error:", err);
        return false;
    }
};
