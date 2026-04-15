import { NextRequest, NextResponse } from "next/server";

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

async function fetchFromKnowYourGst(gstin: string) {
    const apiKey = process.env.GST_API_KEY;
    if (!apiKey) return null;

    const response = await fetch(`https://www.knowyourgst.com/developers/gstincall/?gstin=${gstin}`, {
        headers: { passthrough: apiKey },
        cache: "no-store"
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data?.status_code !== 1) return null;

    const addr = data?.adress || {};
    const fullAddress = [
        addr.floor,
        addr.bno,
        addr.bname,
        addr.street,
        addr.location,
        addr.city,
        addr.state,
        addr.pincode
    ].filter(Boolean).join(", ");

    return {
        success: true,
        data: {
            gstNo: gstin,
            panNo: gstin.substring(2, 12),
            companyName: data["trade-name"] || data["legal-name"] || "",
            traderName: data["legal-name"] || data["trade-name"] || "",
            ownerName: data["legal-name"] || "",
            address: fullAddress || "",
            city: addr.city || addr.location || "",
            district: addr.location || addr.city || "",
            state: addr.state || "",
            pincode: addr.pincode || "",
            gstStatus: data?.sts || "",
            registrationDate: data?.rgdt || "",
            provider: "knowyourgst_fallback"
        }
    };
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const gstin = (searchParams.get("gstin") || "").trim().toUpperCase();

    if (!gstin) {
        return NextResponse.json({ error: "GSTIN is required" }, { status: 400 });
    }

    if (!GSTIN_REGEX.test(gstin)) {
        return NextResponse.json({ success: false, error: "Invalid GSTIN format" }, { status: 400 });
    }

    const clientId = process.env.CASHFREE_CLIENT_ID;
    const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
    const baseUrl = process.env.CASHFREE_VERIFICATION_BASE_URL
        || (process.env.CASHFREE_ENV === "sandbox"
            ? "https://sandbox.cashfree.com/verification"
            : "https://api.cashfree.com/verification");
    const sandboxUrl = "https://sandbox.cashfree.com/verification";
    const prodUrl = "https://api.cashfree.com/verification";

    if (!clientId || !clientSecret) {
        return NextResponse.json(
            {
                success: false,
                error: "Cashfree GST credentials missing. Set CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET."
            },
            { status: 500 }
        );
    }

    try {
        const callCashfree = async (url: string) => {
            const response = await fetch(`${url}/gstin`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-client-id": clientId,
                    "x-client-secret": clientSecret
                },
                body: JSON.stringify({ GSTIN: gstin }),
                cache: "no-store"
            });

            if (response.ok) {
                return { ok: true as const, status: response.status, data: await response.json(), errorMessage: "" };
            }

            let errorMessage = `GST Service Error (${response.status})`;
            try {
                const failed = await response.json();
                errorMessage = failed?.message || failed?.error || errorMessage;
            } catch {
                const errorText = await response.text();
                if (errorText) errorMessage = `${errorMessage}: ${errorText}`;
            }
            return { ok: false as const, status: response.status, data: null, errorMessage };
        };

        let result = await callCashfree(baseUrl);

        // Auto-fix env mismatch: retry on opposite Cashfree environment endpoint.
        if (!result.ok) {
            const msg = result.errorMessage.toLowerCase();
            if (msg.includes("belongs to prod environment") && baseUrl.includes("sandbox")) {
                result = await callCashfree(prodUrl);
            } else if (msg.includes("belongs to sandbox environment") && !baseUrl.includes("sandbox")) {
                result = await callCashfree(sandboxUrl);
            }
        }

        if (!result.ok) {
            const errorMessage = result.errorMessage;
            console.error("Cashfree GST API Error:", result.status, errorMessage);

            const lower = errorMessage.toLowerCase();
            if (lower.includes("ip not whitelisted")) {
                const fallback = await fetchFromKnowYourGst(gstin);
                if (fallback) {
                    return NextResponse.json({
                        ...fallback,
                        warning: "Cashfree blocked this IP (not whitelisted). Fallback provider used."
                    });
                }
            }

            return NextResponse.json({ success: false, error: errorMessage }, { status: result.status });
        }

        const data = result.data;

        if (data?.valid === true || (typeof data?.gst_in_status === "string" && data?.gst_in_status.length > 0)) {
            const splitAddress = data?.principal_place_split_address || {};
            const fullAddress = data?.principal_place_address
                || [
                    splitAddress?.flat_number,
                    splitAddress?.building_number,
                    splitAddress?.building_name,
                    splitAddress?.street,
                    splitAddress?.location,
                    splitAddress?.city,
                    splitAddress?.district,
                    splitAddress?.state,
                    splitAddress?.pincode
                ].filter(Boolean).join(", ");

            return NextResponse.json({
                success: true,
                data: {
                    gstNo: gstin,
                    panNo: gstin.substring(2, 12),
                    companyName: data?.trade_name_of_business || data?.legal_name_of_business || "",
                    traderName: data?.legal_name_of_business || data?.trade_name_of_business || "",
                    ownerName: data?.legal_name_of_business || "",
                    address: fullAddress || "",
                    city: splitAddress?.city || splitAddress?.district || "",
                    district: splitAddress?.district || splitAddress?.city || "",
                    state: splitAddress?.state || "",
                    pincode: splitAddress?.pincode || "",
                    gstStatus: data?.gst_in_status || "",
                    registrationDate: data?.date_of_registration || "",
                    provider: "cashfree"
                }
            });
        }

        return NextResponse.json({ success: false, error: data?.message || "GSTIN not found or invalid" }, { status: 404 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("GST Internal Route Error:", message);

        const fallback = await fetchFromKnowYourGst(gstin);
        if (fallback) {
            return NextResponse.json({
                ...fallback,
                warning: "Cashfree unavailable. Fallback provider used."
            });
        }

        return NextResponse.json({ success: false, error: `Connection failed: ${message}` }, { status: 500 });
    }
}

