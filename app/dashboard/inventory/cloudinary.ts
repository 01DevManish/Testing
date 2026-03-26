export const uploadToCloudinary = async (base64OrUrl: string): Promise<string> => {
    if (!base64OrUrl.startsWith("data:image")) {
        return base64OrUrl; // Already a URL or absolute path
    }

    try {
        const res = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: base64OrUrl })
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || "Failed to upload image to Cloudinary");
        }
        return data.secure_url;
    } catch (err) {
        console.error("Cloudinary Upload Error:", err);
        throw err;
    }
};
