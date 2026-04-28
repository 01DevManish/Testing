import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type IndiaPostRecord = {
  Status?: string;
  PostOffice?: Array<{
    District?: string;
    State?: string;
    Name?: string;
  }>;
};

export async function GET(_: NextRequest, { params }: { params: Promise<{ pincode: string }> }) {
  try {
    const { pincode: rawPincode } = await params;
    const pincode = String(rawPincode || "").trim();
    if (!/^\d{6}$/.test(pincode)) {
      return NextResponse.json({ error: "Invalid pincode" }, { status: 400 });
    }

    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ error: "Lookup failed" }, { status: 502 });
    }

    const payload = (await res.json()) as IndiaPostRecord[];
    const first = Array.isArray(payload) ? payload[0] : undefined;
    const office = first?.PostOffice?.[0];
    const city = String(office?.District || "").trim();
    const state = String(office?.State || "").trim();

    if (!city && !state) {
      return NextResponse.json({ found: false, city: "", state: "" });
    }

    return NextResponse.json({
      found: true,
      city,
      state,
      postOffice: String(office?.Name || "").trim(),
    });
  } catch {
    return NextResponse.json({ error: "Failed to resolve pincode" }, { status: 500 });
  }
}
