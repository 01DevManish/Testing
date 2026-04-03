import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const gstin = searchParams.get("gstin");

    if (!gstin) {
        return NextResponse.json({ error: "GSTIN is required" }, { status: 400 });
    }

    const apiKey = process.env.GST_API_KEY || "ODU3MjgzOTQ3OTM5NzAzMjc2NTA";
    const url = `https://www.knowyourgst.com/developers/gstincall/?gstin=${gstin}`;

    try {
        const response = await fetch(url, {
            headers: {
                "passthrough": apiKey
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error("GST API Proxy Error:", response.status, errorText);
            return NextResponse.json({ 
                success: false, 
                error: `GST Service Error (${response.status}): Please check your API key.` 
            }, { status: response.status });
        }

        const data = await response.json();
        console.log("GST API Data Received:", data);

        // knowyourgst.com returns status_code: 1 for success
        if (data.status_code === 1) {
            const addr = data.adress || {}; // Note: there is a typo in the API response field name: 'adress'
            
            // Build a human-readable address
            const fullAddress = [
                addr.floor, addr.bno, addr.bname, addr.street, 
                addr.location, addr.city, addr.state, addr.pincode
            ].filter(Boolean).join(", ").replace(/ , /g, ", ").trim();

            return NextResponse.json({
                success: true,
                data: {
                    companyName: data["trade-name"] || data["legal-name"] || "Unknown",
                    ownerName: data["legal-name"] || data["trade-name"] || "Unknown",
                    address: fullAddress || "Unknown",
                    city: addr.city || "Unknown",
                    district: addr.location || addr.city || "Unknown",
                    state: addr.state || "Unknown",
                    pincode: addr.pincode || ""
                }
            });
        }

        return NextResponse.json({ success: false, error: data.message || "GSTIN not found or invalid" }, { status: 404 });
    } catch (error: any) {
        console.error("GST Internal Route Error:", error);
        return NextResponse.json({ success: false, error: `Connection failed: ${error.message}` }, { status: 500 });
    }
}

