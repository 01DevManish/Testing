"use client";

import { useState, useEffect } from "react";
import { ref, update } from "@/app/lib/dynamoRtdbCompat";
import { db } from "../../../../lib/firebase";
import { useAuth } from "../../../../context/AuthContext";
import { useData } from "../../../../context/DataContext";
import { logActivity } from "../../../../lib/activityLogger";
import { generateBoxBarcode, generateDispatchBarcode } from "../../../../lib/barcodeUtils";
import { PageHeader, BtnPrimary, BtnGhost, Card } from "../ui";
import { firestoreApi } from "../../data";
import MobileScannerView from "./MobileScannerView";
import { resolveS3Url } from "../../../inventory/components/Products/imageService";
import { touchDataSignal } from "../../../../lib/dataSignals";

interface ScannableItem {
  id: string; // row unique id
  productId: string;
  productName: string;
  sku: string;
  imageUrl?: string;
  barcode?: string;
  packagingType?: string;
  scannedValue: string;
  isPacked: boolean;
  boxName?: string;
}

const FALLBACK_SCANNER_IMAGE = "https://epanelimages.s3.ap-south-1.amazonaws.com/inventory/images/1776344255576-CLR-401.webp";

const normalizeScannerImageUrl = (raw?: string): string => {
  const value = (raw || "").trim();
  if (!value) return FALLBACK_SCANNER_IMAGE;
  if (value.startsWith("http://") || value.startsWith("https://")) return resolveS3Url(value);
  if (value.startsWith("/")) return value;
  return `https://epanelimages.s3.ap-south-1.amazonaws.com/${value.replace(/^\/+/, "")}`;
};

const normalizeSku = (value?: string): string => (value || "").trim().toLowerCase();
const normalizeCode = (value?: string): string => (value || "").trim().toUpperCase();
const normalizePinValue = (value: unknown): string => String(value ?? "").trim().replace(/\D/g, "");
const pinMatches = (enteredPin: string, savedPin: unknown): boolean => {
  const entered = normalizePinValue(enteredPin);
  const saved = normalizePinValue(savedPin);
  if (entered.length !== 4 || !saved) return false;
  return entered === saved || entered === saved.padStart(4, "0");
};

export default function CreateDispatchList({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user, userData } = useAuth();
  const isAdmin = userData?.role === "admin";
  const { refreshData, packingLists: ctxPackingLists, partyRates } = useData();
  const [packingLists, setPackingLists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedList, setSelectedList] = useState<any>(null);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [lrNo, setLrNo] = useState("");
  const [dispatchId, setDispatchId] = useState("");
  const [scannableItems, setScannableItems] = useState<ScannableItem[]>([]);
  const [boxBarcodes, setBoxBarcodes] = useState<Record<string, string>>({});
  const [pin, setPin] = useState("");
  const [inventory, setInventory] = useState<any[]>([]);
  const [currentBoxIndex, setCurrentBoxIndex] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastScanned, setLastScanned] = useState<{ value: string; match: boolean; expected: string } | null>(null);
  const [lastMatchedItem, setLastMatchedItem] = useState<ScannableItem | null>(null);
  const [packageType, setPackageType] = useState<"Box" | "Bale">("Box");
  const [showMobileScanner, setShowMobileScanner] = useState(false);
  const [viewportWidth, setViewportWidth] = useState<number>(typeof window !== "undefined" ? window.innerWidth : 1200);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isMobile = viewportWidth < 640;

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        const inv = await firestoreApi.getInventoryProducts({ forceFresh: true });
        setInventory(inv);
        if (!ctxPackingLists?.length) {
          refreshData("packingLists");
        }
        if (!partyRates?.length) {
          refreshData("partyRates");
        }
      } catch (err) {
        console.error("Failed to load initial data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, [ctxPackingLists?.length, partyRates?.length, refreshData]);

  useEffect(() => {
    const baseLists = (ctxPackingLists || []).filter(
      (val: any) => val.status !== "Completed" && val.status !== "Packed"
    );

    if (isAdmin) {
      setPackingLists(baseLists);
      return;
    }

    const currentUid = String(userData?.uid || user?.uid || "").trim();
    const scoped = currentUid
      ? baseLists.filter((val: any) => String(val?.assignedTo || "").trim() === currentUid)
      : [];
    setPackingLists(scoped);
  }, [ctxPackingLists, isAdmin, userData?.uid, user?.uid]);

  const handleSelectList = async (list: any) => {
    setSelectedList(list);
    
    const partyRateMap: Record<string, string> = {};
    try {
      const targetParty = (list.partyName || "").trim().toLowerCase();
      (partyRates || []).forEach((val: any) => {
        if ((val.partyName || "").trim().toLowerCase() === targetParty) {
          (val.rates || []).forEach((r: any) => {
            if (r.productName) {
              partyRateMap[r.productName.trim().toLowerCase()] = r.packagingType || "";
            }
          });
        }
      });
    } catch (e) {
      console.warn("Failed to resolve party rates for packaging:", e);
    }

    const expanded: ScannableItem[] = [];
    list.items.forEach((item: any) => {
      const itemSkuKey = normalizeSku(item.sku);
      const invProd = inventory.find(p => p.id === item.productId || normalizeSku(p.sku) === itemSkuKey);
      const barcode = invProd?.barcode || "";
      const firstGalleryImage = Array.isArray(invProd?.imageUrls)
        ? (invProd.imageUrls.find((img: unknown) => typeof img === "string" && img.trim()) || "")
        : "";
      const rawImageUrl =
        (typeof invProd?.imageUrl === "string" && invProd.imageUrl.trim()) ||
        firstGalleryImage ||
        (typeof invProd?.image === "string" ? invProd.image : "");
      const imageUrl = normalizeScannerImageUrl(rawImageUrl);
      const prodKey = (item.productName || "").trim().toLowerCase();
      const packagingType = partyRateMap[prodKey] || item.packagingType || item.packingType || list.packagingType || list.packingType || "Box";

      for (let i = 0; i < item.quantity; i++) {
        expanded.push({
          id: `${item.productId}-${i}-${Math.random().toString(36).substr(2, 5)}`,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku || "N/A",
          imageUrl,
          barcode: barcode,
          packagingType: packagingType,
          scannedValue: "",
          isPacked: false
        });
      }
    });
    setScannableItems(expanded);
    
    const newDispId = `DISP-${Math.floor(1000 + Math.random() * 8999)}`;
    setDispatchId(newDispId);
    setBoxBarcodes({});
    setCurrentBoxIndex(1);
    setSelectedIds(new Set());
    setLastMatchedItem(null);
  };

  const currentBoxName = `${packageType === "Box" ? "B" : "BL"}${currentBoxIndex}`;
  const allItemsPacked = scannableItems.every((item) => item.isPacked);
  const nextItemToScan = scannableItems.find((item) => !item.isPacked) || null;
  const previewItem = nextItemToScan || lastMatchedItem;
  const canFinalize = !!selectedList && !saving && allItemsPacked && normalizePinValue(pin).length >= 4 && !!invoiceNo.trim();

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === scannableItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(scannableItems.map(i => i.id)));
    }
  };

  const handleCreateBox = () => {
    if (selectedIds.size === 0) return;
    const itemsInBox = scannableItems.filter(i => selectedIds.has(i.id));
    const collectionCodes = itemsInBox
      .map(item => inventory.find(p => p.id === item.productId)?.collectionCode || "000")
      .filter((v, i, a) => a.indexOf(v) === i);

    const uniqueSkuCount = new Set(itemsInBox.map(i => i.sku)).size;
    const barcode = generateBoxBarcode(currentBoxName, collectionCodes, uniqueSkuCount, itemsInBox.length);

    const newItems = scannableItems.map(item => {
      if (selectedIds.has(item.id)) {
        return { ...item, boxName: currentBoxName };
      }
      return item;
    });
    
    setBoxBarcodes(prev => ({ ...prev, [currentBoxName]: barcode }));
    setScannableItems(newItems);
    setSelectedIds(new Set());
    setCurrentBoxIndex(prev => prev + 1);
  };

  const handleAutoScan = (rawValue: string) => {
    const code = rawValue.trim();
    if (!code) return { success: false, message: "Empty code" };

    // 1. Identify the CURRENT TARGET (First unpacked item)
    const targetItem = scannableItems.find(i => !i.isPacked);
    
    // 2. Helper to check if a code matches an item
    const isMatching = (item: any, scanCode: string) => {
      const normalizedScan = normalizeCode(scanCode);
      const normalizedBarcode = normalizeCode(item?.barcode);
      const normalizedSku = normalizeCode(item?.sku);
      if (!normalizedScan) return false;

      // Accept either mapped barcode or exact SKU (scanner might send either code type).
      if (normalizedBarcode && normalizedScan === normalizedBarcode) return true;
      if (normalizedSku && normalizedScan === normalizedSku) return true;
      return false;
    };

    // 3. Check if we have a match at all
    const anyMatch = scannableItems.find(item => !item.isPacked && isMatching(item, code));

    if (!anyMatch) {
      setLastScanned({ value: code, match: false, expected: "Invalid" });
      return { success: false, message: "Barcode not found in list" };
    }

    // 4. Sequential Check: Is it the target we're looking for?
    if (targetItem && !isMatching(targetItem, code)) {
      setLastScanned({ value: code, match: false, expected: targetItem.sku });
      return { 
        success: false, 
        message: `WRONG ITEM! Expected ${targetItem.sku}`,
        expectedSku: targetItem.sku 
      };
    }

    // 5. Success: Process the match
    const match = anyMatch; 
    const newItems = scannableItems.map(i => 
      i.id === match.id 
        ? { ...i, boxName: i.boxName || currentBoxName, isPacked: true, scannedValue: code } 
        : i
    );
    setScannableItems(newItems);
    setLastScanned({ value: code, match: true, expected: match.sku });
    setLastMatchedItem({ ...match, boxName: match.boxName || currentBoxName, isPacked: true, scannedValue: code });
    return { success: true, item: match };
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const item = scannableItems[idx];
      handleAutoScan(item.scannedValue);
    }
  };

  const handleInputChange = (idx: number, value: string) => {
    const newItems = [...scannableItems];
    newItems[idx].scannedValue = value;
    setScannableItems(newItems);
    
    if (value.trim().length >= 3) {
      const item = newItems[idx];
      let scannedSkuPart = value.trim();
      if (value.trim().length === 13) scannedSkuPart = value.trim().substring(3, 6);
      
      const targetSkuDigits = (item.sku || "").replace(/\D/g, "");
      const targetSkuPart = targetSkuDigits.substring(targetSkuDigits.length - 3).padStart(3, "0");

      if (
        scannedSkuPart === targetSkuPart ||
        normalizeCode(value) === normalizeCode(item.barcode) ||
        normalizeCode(value) === normalizeCode(item.sku)
      ) {
        if (!item.boxName) return;
        newItems[idx].isPacked = true;
        setScannableItems(newItems);
        setLastMatchedItem({ ...newItems[idx] });
        setTimeout(() => {
          const nextInput = document.getElementById(`scan-${idx + 1}`) as HTMLInputElement;
          if (nextInput) nextInput.focus();
        }, 10);
      }
    }
  };

  const handleDispatch = async () => {
    if (!selectedList) return;
    const allPacked = scannableItems.every(i => i.isPacked);
    if (!allPacked) {
      alert("Please scan all items before finalizing.");
      return;
    }

    if (!pinMatches(pin, (userData as { dispatchPin?: unknown } | null)?.dispatchPin)) {
      alert("Incorrect MPIN. Access denied.");
      setPin("");
      return;
    }

    setSaving(true);
    try {
      const listRef = ref(db, `packingLists/${selectedList.id}`);
      const dispId = dispatchId || `DISP-${Math.floor(1000 + Math.random() * 8999)}`;
      // Use actual assigned box names from scanned items (avoids off-by-one from currentBoxIndex UI state).
      const totalBoxes = new Set(
        scannableItems
          .map(i => (i.boxName || "").trim())
          .filter(Boolean)
      ).size;
      const totalItems = scannableItems.length;
      const finalDispatchBarcode = generateDispatchBarcode(dispId, totalBoxes, totalItems);

      const updatedRecordItems = scannableItems.reduce((acc: any[], item) => {
        const itemSkuKey = normalizeSku(item.sku);
        const existing = acc.find((x) => {
          const sameBox = String(x.boxName || "") === String(item.boxName || "");
          if (!sameBox) return false;

          const existingProductId = String(x.productId || "");
          const itemProductId = String(item.productId || "");
          if (existingProductId && itemProductId && existingProductId === itemProductId) {
            return true;
          }

          const existingSkuKey = normalizeSku(x.sku);
          return !!itemSkuKey && !!existingSkuKey && itemSkuKey === existingSkuKey;
        });
        if (existing) {
          existing.quantity = (existing.quantity || 0) + 1;
        } else {
          acc.push({
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            quantity: 1,
            boxName: item.boxName,
            packagingType: item.packagingType || "Box"
          });
        }
        return acc;
      }, []);

      const deductionMap = new Map<string, { qty: number; productId?: string; sku?: string; productName?: string }>();
      for (const item of scannableItems) {
        const skuKey = normalizeSku(item.sku);
        const dedupeKey = item.productId
          ? `id:${item.productId}`
          : (skuKey && skuKey !== "n/a" ? `sku:${skuKey}` : "");

        if (!dedupeKey) {
          console.warn("Item skipped for stock deduction because it lacks both productId and valid SKU:", item);
          continue;
        }

        if (!deductionMap.has(dedupeKey)) {
          deductionMap.set(dedupeKey, {
            qty: 1,
            productId: item.productId,
            sku: item.sku,
            productName: item.productName
          });
        } else {
          deductionMap.get(dedupeKey)!.qty += 1;
        }
      }

      // Live inventory check right before finalization to block out-of-stock dispatches.
      const latestInventory = await firestoreApi.getInventoryProducts({ forceFresh: true });
      const stockIssues: string[] = [];

      for (const { qty, productId, sku, productName } of deductionMap.values()) {
        const skuKey = normalizeSku(sku);
        const invProd =
          latestInventory.find((p: any) => productId && p.id === productId) ||
          latestInventory.find((p: any) => skuKey && skuKey !== "n/a" && normalizeSku(p.sku) === skuKey);

        const currentStock = Number(invProd?.stock) || 0;
        if (!invProd?.id) {
          stockIssues.push(`${productName || sku || "Item"}: not found in inventory`);
        } else if (currentStock <= 0) {
          stockIssues.push(`${productName || invProd.productName || sku || "Item"}: out of stock`);
        } else if (qty > currentStock) {
          stockIssues.push(`${productName || invProd.productName || sku || "Item"}: required ${qty}, available ${currentStock}`);
        }
      }

      if (stockIssues.length > 0) {
        alert(`Cannot finalize dispatch due to live stock mismatch:\n\n${stockIssues.join("\n")}`);
        return;
      }

      await update(listRef, {
        status: "Packed",
        invoiceNo,
        dispatchId: dispId,
        dispatchBarcode: finalDispatchBarcode,
        boxBarcodes,
        lrNo,
        bails: totalBoxes,
        items: updatedRecordItems, 
        dispatchedAt: Date.now(),
        dispatchedBy: userData?.name || user?.name || "System",
        stockDeducted: true
      });
      await touchDataSignal("packingLists");

      fetch("/api/data/packingLists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "upsert",
          items: [{
            ...selectedList,
            id: selectedList.id,
            status: "Packed",
            invoiceNo,
            dispatchId: dispId,
            dispatchBarcode: finalDispatchBarcode,
            boxBarcodes,
            lrNo,
            bails: totalBoxes,
            items: updatedRecordItems,
            dispatchedAt: Date.now(),
            dispatchedBy: userData?.name || user?.name || "System",
            stockDeducted: true,
            updatedAt: Date.now(),
          }],
        }),
      }).catch(() => {});

      for (const { qty, productId, sku, productName } of deductionMap.values()) {
        const skuKey = normalizeSku(sku);
        const invProd =
          latestInventory.find((p: any) => productId && p.id === productId) ||
          latestInventory.find((p: any) => skuKey && skuKey !== "n/a" && normalizeSku(p.sku) === skuKey);

        if (invProd?.id) {
          await firestoreApi.deductStock(invProd.id, qty);
        } else {
          console.warn("Could not find inventory product to deduct stock:", { productId, sku, productName, qty });
        }
      }
      
      refreshData("inventory");

      await logActivity({
        type: "dispatch",
        action: "update",
        title: "Retail Dispatch Finalized",
        description: `Retail Dispatch ${dispId} for ${selectedList.partyName} verified with scan and finalized.`,
        userId: user?.uid || "",
        userName: userData?.name || "Admin",
        userRole: userData?.role || "admin",
        metadata: { 
          packingListId: selectedList.id, 
          dispatchId: dispId,
          invoiceNo,
          lrNo, 
          unitsScanned: scannableItems.length,
          totalBoxes: totalBoxes,
          items: scannableItems.map(i => ({ productName: i.productName, sku: i.sku, boxName: i.boxName, packagingType: i.packagingType }))
        }
      });

      alert("Dispatch finalized successfully!");
      onCreated();
    } catch (err) {
      console.error("Failed to finalize dispatch:", err);
      alert("Error finalizing dispatch.");
    } finally {
      setSaving(false);
    }
  };
if (loading) return <div className="p-8 text-center text-slate-500">Loading packing lists...</div>;

  return (
    <div style={{ animation: "fadeIn 0.3s ease-out" }}>
      <PageHeader title="Finalize Dispatch List" sub="Convert a completed packing list into a final dispatch.">
        <div style={{ display: "flex", gap: 8, width: isMobile ? "100%" : "auto" }}>
          <BtnGhost onClick={onClose} style={isMobile ? { flex: 1, justifyContent: "center" } : undefined}>Cancel</BtnGhost>
          <BtnPrimary onClick={handleDispatch} disabled={!canFinalize} style={isMobile ? { flex: 1, justifyContent: "center" } : undefined}>
            {saving ? "Finalizing..." : "Finalize Dispatch"}
          </BtnPrimary>
        </div>
      </PageHeader>

      {!selectedList ? (
        <Card style={{ padding: 0, overflow: "hidden" }}>
           <div className="p-6 border-b border-slate-100">
             <h3 className="text-base font-semibold text-slate-800">Pending Packing Lists</h3>
             <p className="text-xs text-slate-500 mt-1">Select a packing list to finalize its dispatch.</p>
           </div>
           {isMobile && (
             <div className="p-4 space-y-3 bg-slate-50/70">
               {packingLists.map((list) => (
                 <div key={list.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                   <div className="flex items-center justify-between gap-3">
                     <div className="text-sm font-bold text-slate-800">#{list.id.slice(-6)}</div>
                     <div className="text-[10px] uppercase tracking-wider font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                       {list.items?.reduce((acc: number, val: any) => acc + (Number(val.quantity) || 1), 0) || 0} Items
                     </div>
                   </div>
                   <div className="mt-2 text-sm font-semibold text-slate-700">{list.partyName}</div>
                   <div className="mt-1 text-xs text-slate-500">Assigned: {list.assignedToName}</div>
                   <button
                     onClick={() => handleSelectList(list)}
                     className="mt-3 w-full text-sm font-bold text-white bg-indigo-600 px-3 py-2.5 rounded-lg active:scale-[0.99] transition-transform"
                   >
                     Select and Start Scanning
                   </button>
                 </div>
               ))}
               {packingLists.length === 0 && (
                 <div className="px-6 py-10 text-center text-slate-400 italic text-sm">No pending packing lists found.</div>
               )}
             </div>
           )}
           {!isMobile && (
           <div className="overflow-x-auto">
             <table className="w-full border-collapse">
               <thead className="bg-slate-50">
                 <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Party Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Items</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned To</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                 </tr>
               </thead>
               <tbody className="bg-white divide-y divide-slate-100">
                 {packingLists.map(list => (
                   <tr key={list.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">#{list.id.slice(-6)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{list.partyName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{list.items.length} Products</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{list.assignedToName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button 
                          onClick={() => handleSelectList(list)}
                          className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                          Select →
                        </button>
                      </td>
                   </tr>
                 ))}
                 {packingLists.length === 0 && (
                   <tr>
                     <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic text-sm">No pending packing lists found.</td>
                   </tr>
                 )}
               </tbody>
             </table>
           </div>
           )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
          <div className="lg:col-span-2">
            <Card
              style={{
                padding: 0,
                overflow: "hidden",
                border: "1px solid #e2e8f0",
                boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
              }}
            >
              <div
                className={`border-b border-slate-100 bg-white ${isMobile ? "p-4" : "p-5"} ${
                  isMobile ? "space-y-3" : "flex items-start justify-between gap-4"
                }`}
              >
                <div className="space-y-2">
                  <div>
                    <h4 className={`${isMobile ? "text-sm font-semibold" : "text-base font-semibold"} text-slate-800`}>
                      Dispatch Scanning
                    </h4>
                    <p className={`${isMobile ? "text-[11px]" : "text-xs"} mt-1 text-slate-500`}>
                      Scan each item in sequence and assign it to the active {packageType.toLowerCase()}.
                    </p>
                  </div>
                  {previewItem && (
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <img
                        src={normalizeScannerImageUrl(previewItem.imageUrl)}
                        alt={previewItem.productName}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_SCANNER_IMAGE; }}
                        className="h-12 w-12 rounded-xl border border-slate-200 bg-white object-cover"
                      />
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {nextItemToScan ? "Now Scanning" : "Last Scanned"}
                        </p>
                        <p className="truncate text-xs font-semibold text-slate-700">{previewItem.productName}</p>
                        <p className="truncate text-[11px] font-mono text-slate-500">{previewItem.sku}</p>
                      </div>
                    </div>
                  )}
                  <div className={`flex ${isMobile ? "flex-col items-start gap-2" : "items-center gap-3"}`}>
                    <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">Assign To</span>
                      <select
                        value={packageType}
                        onChange={(e) => setPackageType(e.target.value as "Box" | "Bale")}
                        className="ml-2 cursor-pointer bg-transparent text-xs font-medium text-indigo-600 outline-none"
                      >
                        <option value="Box">Box</option>
                        <option value="Bale">Bale</option>
                      </select>
                    </div>
                    {isMobile && (
                      <div className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5">
                        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-indigo-500">Next</span>
                        <span className="ml-2 text-sm font-semibold text-indigo-700">{currentBoxName}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className={`flex ${isMobile ? "flex-col items-stretch gap-2" : "items-center gap-3"}`}>
                  {selectedIds.size > 0 && (
                    <button
                      onClick={handleCreateBox}
                      className={`flex items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-700 ${
                        isMobile ? "px-4 py-3 text-xs font-semibold" : "px-4 py-2.5 text-[11px] font-semibold"
                      }`}
                    >
                      Create {packageType} {currentBoxName} ({selectedIds.size})
                    </button>
                  )}
                  <div className={`flex ${isMobile ? "flex-col items-stretch gap-2" : "items-center gap-2"}`}>
                    <button
                      onClick={() => setShowMobileScanner(true)}
                      className={`flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white transition-colors hover:bg-slate-800 ${
                        isMobile ? "px-4 py-3 text-xs font-semibold" : "px-4 py-2.5 text-[11px] font-semibold"
                      }`}
                    >
                      <span>Mobile Scanner</span>
                    </button>
                    {!isMobile && (
                      <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">Next {packageType}</span>
                        <span className="ml-3 text-sm font-semibold text-slate-700">{currentBoxName}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {isMobile ? (
                <div className="space-y-3 bg-slate-50/60 p-4">
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <label className="flex items-center gap-3 text-[11px] text-slate-600">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === scannableItems.length && scannableItems.length > 0}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      Select all rows
                    </label>
                    <span className="text-[11px] font-medium text-slate-500">{scannableItems.length} items</span>
                  </div>

                  {scannableItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`rounded-2xl border px-4 py-4 shadow-sm transition-colors ${
                        item.isPacked
                          ? "border-emerald-100 bg-emerald-50/70"
                          : selectedIds.has(item.id)
                            ? "border-indigo-200 bg-indigo-50/70"
                            : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          disabled={item.isPacked || !!item.boxName}
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelection(item.id)}
                          className={`mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 ${
                            item.isPacked || !!item.boxName ? "cursor-not-allowed opacity-20" : "cursor-pointer"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-slate-800">{item.productName}</div>
                              <div className="mt-1 text-[11px] font-mono text-slate-500">SKU: {item.sku}</div>
                            </div>
                            <div
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${
                                item.isPacked
                                  ? "border-emerald-200 bg-emerald-100 text-emerald-600"
                                  : "border-slate-200 bg-slate-50 text-slate-300"
                              }`}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.78 4.78 4 4 0 0 1-6.74 0 4 4 0 0 1-4.77-4.78 4 4 0 0 1 0-6.74z" />
                                {item.isPacked && <path d="m9 12 2 2 4-4" />}
                              </svg>
                            </div>
                          </div>

                          <div className="mt-3">
                            <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                              Scanner Input
                            </label>
                            <div className="relative">
                              <input
                                id={`scan-${idx}`}
                                type="text"
                                placeholder="Ready for scan"
                                autoComplete="off"
                                value={item.scannedValue}
                                disabled={item.isPacked}
                                onChange={(e) => handleInputChange(idx, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(idx, e)}
                                onFocus={(e) => (e.target as HTMLInputElement).select()}
                                className={`w-full rounded-xl border px-4 py-3 font-mono text-xs outline-none transition-all ${
                                  item.isPacked
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : item.scannedValue.length > 0
                                      ? "border-rose-200 bg-rose-50 text-rose-700 focus:border-rose-400"
                                      : "border-slate-200 bg-white text-slate-700 focus:border-indigo-500"
                                }`}
                              />
                              {item.isPacked ? (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                                    <svg width="10" height="8" viewBox="0 0 12 9" fill="none">
                                      <path d="M1 4.5L4.5 8L11 1.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </div>
                                </div>
                              ) : item.scannedValue.length > 0 ? (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-semibold text-white">
                                    x
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div>
                              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">Box No.</div>
                              {item.boxName ? (
                                <div className="mt-1 space-y-1">
                                  <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                                    {item.boxName}
                                  </span>
                                  {boxBarcodes[item.boxName] && (
                                    <div className="text-[10px] font-mono text-slate-400">{boxBarcodes[item.boxName]}</div>
                                  )}
                                </div>
                              ) : (
                                <div className="mt-1 text-xs text-slate-400">Pending</div>
                              )}
                            </div>
                            <div className={`rounded-full px-3 py-1 text-[11px] font-medium ${item.isPacked ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                              {item.isPacked ? "Verified" : "Waiting"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="max-h-[550px] overflow-y-auto bg-[#f8fafc]/50">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-10 border-b border-slate-200 bg-[#f8fafc]">
                      <tr>
                        <th className="w-10 px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.size === scannableItems.length && scannableItems.length > 0}
                            onChange={toggleSelectAll}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </th>
                        <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Item Details</th>
                        <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Scanner Input</th>
                        <th className="px-6 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">Box No.</th>
                        <th className="px-6 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">Verify</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {scannableItems.map((item, idx) => (
                        <tr key={item.id} className={`group transition-colors hover:bg-white ${item.isPacked ? "bg-emerald-50/10" : selectedIds.has(item.id) ? "bg-indigo-50/30" : ""}`}>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              disabled={item.isPacked || !!item.boxName}
                              checked={selectedIds.has(item.id)}
                              onChange={() => toggleSelection(item.id)}
                              className={`h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 ${item.isPacked || !!item.boxName ? "cursor-not-allowed opacity-20" : "cursor-pointer"}`}
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-[13px] font-semibold text-slate-700">{item.productName}</div>
                            <div className="mt-0.5 text-[10px] font-mono text-slate-400">SKU: {item.sku}</div>
                          </td>
                          <td className="w-[280px] px-6 py-4">
                            <div className="relative">
                              <input
                                id={`scan-${idx}`}
                                type="text"
                                placeholder="Ready for scan"
                                autoComplete="off"
                                value={item.scannedValue}
                                disabled={item.isPacked}
                                onChange={(e) => handleInputChange(idx, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(idx, e)}
                                onFocus={(e) => (e.target as HTMLInputElement).select()}
                                className={`w-full border-[1.5px] bg-white p-2.5 px-4 font-mono text-[13px] outline-none transition-all ${
                                  item.isPacked
                                    ? "border-emerald-200 bg-emerald-50/20 text-emerald-700 shadow-inner"
                                    : item.scannedValue.length > 0
                                      ? "border-rose-200 bg-rose-50/20 text-rose-700 ring-rose-50/50 focus:border-rose-500"
                                      : "border-slate-200 text-slate-700 shadow-sm ring-indigo-50/50 focus:border-indigo-500 focus:ring-4"
                                }`}
                              />
                              {item.isPacked ? (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-200">
                                    <svg width="10" height="8" viewBox="0 0 12 9" fill="none">
                                      <path d="M1 4.5L4.5 8L11 1.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </div>
                                </div>
                              ) : item.scannedValue.length > 0 ? (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-semibold text-white shadow-lg shadow-rose-200">
                                    x
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {item.boxName ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className="inline-flex items-center gap-1 rounded-md border border-amber-100 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                                  {item.boxName}
                                </span>
                                {boxBarcodes[item.boxName] && (
                                  <span className="text-[9px] font-mono text-slate-400">{boxBarcodes[item.boxName]}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] font-medium italic text-slate-300">Pending</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-lg transition-all ${item.isPacked ? "scale-110 text-emerald-500" : "text-slate-200 group-hover:text-slate-300"}`}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.78 4.78 4 4 0 0 1-6.74 0 4 4 0 0 1-4.77-4.78 4 4 0 0 1 0-6.74z" />
                                {item.isPacked && <path d="m9 12 2 2 4-4" />}
                              </svg>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-5">
            <Card style={{ padding: isMobile ? 18 : 24, background: "#ffffff", border: "1px solid #e2e8f0" }}>
              <div className={`${isMobile ? "mb-5 space-y-3" : "mb-6 flex items-start justify-between gap-4"}`}>
                <div>
                  <h3 className={`${isMobile ? "text-base font-semibold" : "text-lg font-semibold"} text-slate-800`}>
                    {selectedList.partyName}
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-500">#{selectedList.id.slice(-6)}</p>
                </div>
                <button
                  onClick={() => setSelectedList(null)}
                  className={`${isMobile ? "w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" : "text-xs"} text-slate-500 transition-colors hover:text-red-500`}
                >
                  Change List
                </button>
              </div>

              <div className={`${isMobile ? "mb-4 grid grid-cols-2 gap-3" : "mb-6 grid grid-cols-2 gap-4"}`}>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">Items</div>
                  <div className={`${isMobile ? "mt-2 text-lg font-semibold" : "mt-2 text-2xl font-semibold"} text-slate-800`}>
                    {scannableItems.length}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">Verified</div>
                  <div className={`${isMobile ? "mt-2 text-lg font-semibold" : "mt-2 text-2xl font-semibold"} text-slate-800`}>
                    {scannableItems.filter((item) => item.isPacked).length}
                  </div>
                </div>
              </div>

              <div className={`${isMobile ? "space-y-5" : "space-y-6"}`}>
                <div>
                  <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                    Invoice Number
                  </label>
                  <input
                    type="text"
                    placeholder="INV-"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    className={`w-full rounded-xl border border-slate-200 bg-white outline-none transition-all focus:border-indigo-500 ${isMobile ? "px-4 py-3 text-sm font-medium" : "p-3 text-sm font-semibold"}`}
                  />
                  <p className="mt-2 px-1 text-[10px] text-slate-400">This field is mandatory for tracking.</p>
                </div>

                <div className="border-t border-slate-100 pt-5">
                  <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                    Security Verification
                  </label>
                  <input
                    type="password"
                    placeholder="Enter MPIN"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className={`mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 text-center outline-none transition-all focus:border-indigo-500 ${isMobile ? "px-4 py-3 text-base font-semibold" : "p-3 text-lg font-bold"}`}
                  />
                  <BtnPrimary
                    onClick={handleDispatch}
                    disabled={!canFinalize}
                    style={{
                      padding: isMobile ? "12px" : "14px",
                      fontSize: isMobile ? 13 : 14,
                      width: "100%",
                      justifyContent: "center",
                    }}
                  >
                    {saving ? "Processing..." : "Complete Verification"}
                  </BtnPrimary>
                  <p className="mt-3 px-2 text-center text-[10px] text-slate-400">
                    Ensure all {scannableItems.length} items are scanned and your MPIN is correct to finalize.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {showMobileScanner && selectedList && (
        <MobileScannerView 
          partyName={selectedList.partyName}
          scannableItems={scannableItems}
          currentBoxName={currentBoxName}
          packageType={packageType}
          onBoxChange={(idx) => setCurrentBoxIndex(idx)}
          onScan={handleAutoScan}
          onClose={() => setShowMobileScanner(false)}
        />
      )}
    </div>
  );
}


