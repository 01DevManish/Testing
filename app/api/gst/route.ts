import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const gstin = searchParams.get("gstin");

    if (!gstin) {
        return NextResponse.json({ error: "GSTIN is required" }, { status: 400 });
    }

    const apiKey = process.env.GST_API_KEY || "fec9b7469b8955016f06a76da9686184";
    const url = `https://sheet.gstincheck.co.in/check/${apiKey}/${gstin}`;

    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error("GST API Proxy Error:", response.status, errorText);
            return NextResponse.json({ 
                success: false, 
                error: `GST Service Error (${response.status}): Please check your API key or internet.` 
            }, { status: response.status });
        }

        const data = await response.json();
        console.log("GST API Data Received:", data);

        if (data.flag === true && data.data) {
            const d = data.data;
            const addr = d.pradr?.addr || {};
            
            return NextResponse.json({
                success: true,
                data: {
                    companyName: d.tradeNam || d.lgnm || "Unknown",
                    ownerName: d.lgnm || d.tradeNam || "Unknown",
                    address: d.pradr?.adr || `${addr.bno || ""}, ${addr.bnm || ""}, ${addr.st || ""}, ${addr.loc || ""}, ${addr.city || ""}, ${addr.dst || ""}, ${addr.stcd || ""} - ${addr.pncd || ""}`.replace(/^, /, "").replace(/ , /g, ", ").trim(),
                    city: addr.city || "Unknown",
                    district: addr.dst || "Unknown",
                    state: addr.stcd || "Unknown",
                    pincode: addr.pncd || ""
                }
            });
        }

        return NextResponse.json({ success: false, error: data.message || "GSTIN not found or invalid" }, { status: 404 });
    } catch (error: any) {
        console.error("GST Internal Route Error:", error);
        return NextResponse.json({ success: false, error: `Connection failed: ${error.message}` }, { status: 500 });
    }
}
