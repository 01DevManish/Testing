import { NextResponse } from "next/server";
import { db } from "../../lib/firebase";
import { ref, get, update } from "firebase/database";
import { getBarcodeMappedFields } from "../../dashboard/inventory/utils/barcodeUtils";
import { Collection } from "../../dashboard/inventory/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const invSnap = await get(ref(db, "inventory"));
    const colSnap = await get(ref(db, "collections"));
    
    const collections: Collection[] = [];
    if (colSnap.exists()) {
        colSnap.forEach(c => {
            const data = c.val() as any;
            collections.push({
               id: c.key as string,
               name: data.name || "",
               collectionCode: data.collectionCode || "",
               description: data.description || "",
               productIds: Array.isArray(data.productIds) ? data.productIds : [],
               createdAt: Number(data.createdAt) || 0
            });
        });
    }

    const updates: any = {};
    let count = 0;
    
    invSnap.forEach(c => {
      const p = c.val();
      // Only generate if barcode is totally missing
      if (!p.barcode || p.barcode.trim() === "") {
          const newFields = getBarcodeMappedFields({
              id: c.key as string,
              sku: p.sku || "",
              styleId: p.styleId || "",
              collection: p.collection || ""
          }, collections);
          
          updates[`inventory/${c.key}/barcode`] = newFields.barcode;
          updates[`inventory/${c.key}/barcodeSku`] = newFields.barcodeSku;
          count++;
      }
    });

    if (count > 0) {
        await update(ref(db), updates);
        return NextResponse.json({ success: true, count, message: `Successfully generated barcodes for ${count} existing products!` });
    } else {
        return NextResponse.json({ success: true, count: 0, message: `All existing products already have valid mapped barcodes!` });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
