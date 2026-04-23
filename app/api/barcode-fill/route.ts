import { NextResponse } from "next/server";
import { QueryCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { DATA_TABLE_NAME, docClient } from "../../lib/dynamodb";
import { getBarcodeMappedFields } from "../../dashboard/inventory/utils/barcodeUtils";
import { Collection } from "../../dashboard/inventory/types";

export const runtime = "nodejs";

type AnyRow = Record<string, any>;

const loadEntityRows = async (entity: string): Promise<AnyRow[]> => {
  const rows: AnyRow[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: DATA_TABLE_NAME,
        KeyConditionExpression: "#p = :pk AND begins_with(#s, :prefix)",
        ExpressionAttributeNames: { "#p": "partition", "#s": "timestamp_id" },
        ExpressionAttributeValues: { ":pk": `DATA#${entity}`, ":prefix": "ITEM#" },
        ExclusiveStartKey: lastKey,
      })
    );
    (result.Items || []).forEach((i) => {
      if (i?.payload && typeof i.payload === "object") rows.push(i.payload as AnyRow);
    });
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);
  return rows;
};

export async function GET() {
  try {
    const inventory = await loadEntityRows("inventory");
    const collectionsRaw = await loadEntityRows("collections");

    const collections: Collection[] = collectionsRaw.map((c) => ({
      id: String(c.id || ""),
      name: String(c.name || ""),
      collectionCode: String(c.collectionCode || ""),
      description: String(c.description || ""),
      productIds: Array.isArray(c.productIds) ? c.productIds : [],
      createdAt: Number(c.createdAt) || 0,
    }));

    const updates = inventory.map((p) => {
      const barcode = String(p.barcode || "").trim();
      if (barcode) return p;
      const newFields = getBarcodeMappedFields(
        {
          id: String(p.id || ""),
          sku: String(p.sku || ""),
          styleId: String(p.styleId || ""),
          collection: String(p.collection || ""),
        },
        collections
      );
      return {
        ...p,
        barcode: newFields.barcode,
        barcodeSku: newFields.barcodeSku,
      };
    });

    const changed = updates.filter((row, i) => String(inventory[i]?.barcode || "").trim() !== String(row.barcode || "").trim());
    if (changed.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: "All existing products already have valid mapped barcodes!" });
    }

    for (let i = 0; i < updates.length; i += 25) {
      const chunk = updates.slice(i, i + 25);
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [DATA_TABLE_NAME]: chunk
              .filter((row) => String(row.id || "").trim())
              .map((row) => ({
                PutRequest: {
                  Item: {
                    partition: "DATA#inventory",
                    timestamp_id: `ITEM#${String(row.id).trim()}`,
                    entityType: "dataset_inventory",
                    payload: row,
                    updatedAt: Date.now(),
                  },
                },
              })),
          },
        })
      );
    }

    return NextResponse.json({
      success: true,
      count: changed.length,
      message: `Successfully generated barcodes for ${changed.length} existing products!`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
