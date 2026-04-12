"use client";

import { useState, useEffect } from "react";
import { ref, get, update } from "firebase/database";
import { db } from "../../../../lib/firebase";
import { useAuth } from "../../../../context/AuthContext";
import { logActivity } from "../../../../lib/activityLogger";
import { generateBoxBarcode, generateDispatchBarcode } from "../../../../lib/barcodeUtils";
import { PageHeader, BtnPrimary, BtnGhost, Card } from "../ui";
import { firestoreApi } from "../../data";

interface ScannableItem {
  id: string; // row unique id
  productId: string;
  productName: string;
  sku: string;
  barcode?: string;
  packagingType?: string;
  scannedValue: string;
  isPacked: boolean;
  boxName?: string;
}

export default function CreateDispatchList({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user, userData } = useAuth();
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
  const [packageType, setPackageType] = useState<"Box" | "Bale">("Box");

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        // Load Inventory for matching
        const inv = await firestoreApi.getInventoryProducts();
        setInventory(inv);

        const listsRef = ref(db, "packingLists");
        const snap = await get(listsRef);
        if (snap.exists()) {
          const data: any[] = [];
          snap.forEach((child) => {
            const val = child.val();
            if (val.status !== "Completed" && val.status !== "Packed") {
              data.push({ id: child.key, ...val });
            }
          });
          setPackingLists(data);
        }
      } catch (err) {
        console.error("Failed to load initial data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  const handleSelectList = async (list: any) => {
    setSelectedList(list);
    
    // Resolve Party Rates for this party to get packaging types
    let partyRateMap: Record<string, string> = {};
    try {
      const partyRatesRef = ref(db, "partyRates");
      const snap = await get(partyRatesRef);
      if (snap.exists()) {
        const targetParty = (list.partyName || "").trim().toLowerCase();
        snap.forEach(child => {
          const val = child.val();
          if ((val.partyName || "").trim().toLowerCase() === targetParty) {
            (val.rates || []).forEach((r: any) => {
              if (r.productName) {
                partyRateMap[r.productName.trim().toLowerCase()] = r.packagingType || "";
              }
            });
          }
        });
      }
    } catch (e) {
      console.warn("Failed to resolve party rates for packaging:", e);
    }

    // Expand items by quantity
    const expanded: ScannableItem[] = [];
    list.items.forEach((item: any, idx: number) => {
      // Find real barcode from inventory state
      const invProd = inventory.find(p => p.id === item.productId || p.sku === item.sku);
      const barcode = invProd?.barcode || "";
      
      // Resolve packaging type from party rate map (case-insensitive)
      const prodKey = (item.productName || "").trim().toLowerCase();
      const packagingType = partyRateMap[prodKey] || item.packagingType || item.packingType || list.packagingType || list.packingType || "Box";

      for (let i = 0; i < item.quantity; i++) {
        expanded.push({
          id: `${item.productId}-${i}-${Math.random().toString(36).substr(2, 5)}`,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku || "N/A",
          barcode: barcode,
          packagingType: packagingType,
          scannedValue: "",
          isPacked: false
        });
      }
    });
    setScannableItems(expanded);
    
    // Generate Dispatch ID upfront for barcode consistency
    const newDispId = `DISP-${Math.floor(1000 + Math.random() * 8999)}`;
    setDispatchId(newDispId);
    
    setBoxBarcodes({});
    setCurrentBoxIndex(1); // Reset box count
    setSelectedIds(new Set());
  };

  const currentBoxName = `${packageType === "Box" ? "B" : "BL"}${currentBoxIndex}`;

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

    // 1. Identify items for this box
    const itemsInBox = scannableItems.filter(i => selectedIds.has(i.id));
    
    // 2. Resolve Collection IDs and unique SKUs for these items
    const collectionCodes = itemsInBox
      .map(item => inventory.find(p => p.id === item.productId)?.collectionCode || "000")
      .filter((v, i, a) => a.indexOf(v) === i); // Unique

    const uniqueSkuCount = new Set(itemsInBox.map(i => i.sku)).size;

    // 3. Generate 15-digit Barcode
    const barcode = generateBoxBarcode(
      currentBoxName,
      collectionCodes,
      uniqueSkuCount,
      itemsInBox.length
    );

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

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const item = scannableItems[idx];
      const rawValue = item.scannedValue.trim();
      
      // Extraction: Index 3-6 is digits 4, 5, 6 (Pos 4 to 6)
      let scannedSkuPart = rawValue;
      if (rawValue.length === 13) {
        scannedSkuPart = rawValue.substring(3, 6);
      }

      // Normalization: Match how inventory generates SKU parts (last 3 digits)
      const targetSkuDigits = (item.sku || "").replace(/\D/g, "");
      // Take the 3 digits that the system is likely looking for
      const targetSkuPart = targetSkuDigits.substring(Math.max(0, targetSkuDigits.length - 3)).padStart(3, "0");

      const isBarcodeMatch = rawValue === item.barcode;
      // MATCH LOGIC: Full match OR 3-digit part match OR exact SKU match
      const isSkuMatch = 
        (scannedSkuPart && scannedSkuPart === targetSkuPart) || 
        rawValue.toUpperCase() === item.sku.toUpperCase() ||
        (rawValue.length >= 3 && item.sku.includes(rawValue));

      setLastScanned({ value: rawValue, match: !!(isBarcodeMatch || isSkuMatch), expected: item.sku });

      if (isBarcodeMatch || isSkuMatch) {
        if (!item.boxName) {
          alert(`Please assign this item to a box (B1, B2...) before scanning.`);
          const newItems = [...scannableItems];
          newItems[idx].scannedValue = "";
          setScannableItems(newItems);
          return;
        }

        const newItems = [...scannableItems];
        newItems[idx].isPacked = true;
        setScannableItems(newItems);
        
        // Auto-Focus Next
        setTimeout(() => {
          const nextInput = document.getElementById(`scan-${idx + 1}`) as HTMLInputElement;
          if (nextInput) {
            nextInput.focus();
          } else {
             document.getElementById(`scan-${idx}`)?.blur();
          }
        }, 10);
      } else {
        console.log("Mismatch Details:", { 
          fullScan: rawValue, 
          extracted: scannedSkuPart, 
          target: targetSkuPart, 
          originalSku: item.sku 
        });
      }
    }
  };

  const handleInputChange = (idx: number, value: string) => {
    const newItems = [...scannableItems];
    newItems[idx].scannedValue = value;
    setScannableItems(newItems);
    
    const rawValue = value.trim();
    if (rawValue.length === 13) {
      const scannedSkuPart = rawValue.substring(3, 6);
      const targetSkuDigits = (newItems[idx].sku || "").replace(/\D/g, "");
      const targetSkuPart = targetSkuDigits.substring(targetSkuDigits.length - 3).padStart(3, "0");

      if (scannedSkuPart === targetSkuPart || rawValue === newItems[idx].barcode) {
        if (!newItems[idx].boxName) return;
        newItems[idx].isPacked = true;
        setScannableItems(newItems);
        setTimeout(() => {
          const nextInput = document.getElementById(`scan-${idx + 1}`) as HTMLInputElement;
          if (nextInput) nextInput.focus();
        }, 10);
      }
    } else if (rawValue.toUpperCase() === newItems[idx].sku.toUpperCase()) {
       if (!newItems[idx].boxName) return;
       newItems[idx].isPacked = true;
       setScannableItems(newItems);
       setTimeout(() => {
         const nextInput = document.getElementById(`scan-${idx + 1}`) as HTMLInputElement;
         if (nextInput) nextInput.focus();
       }, 10);
    }
  };

  const handleDispatch = async () => {
    if (!selectedList) return;
    
    // 1. Check if all items are packed
    const allPacked = scannableItems.every(i => i.isPacked);
    if (!allPacked) {
      alert("Please scan all items before finalizing.");
      return;
    }

    // 2. Verify PIN
    if (pin !== userData?.dispatchPin) {
      alert("Incorrect MPIN. Access denied.");
      setPin("");
      return;
    }

    setSaving(true);
    try {
      const listRef = ref(db, `packingLists/${selectedList.id}`);
      const dispId = dispatchId || `DISP-${Math.floor(1000 + Math.random() * 8999)}`;
      
      const totalBoxes = currentBoxIndex - 1;
      const totalItems = scannableItems.length;

      // New 15-digit Dispatch Barcode
      const finalDispatchBarcode = generateDispatchBarcode(dispId, totalBoxes, totalItems);

      // Prepare updated items list for the record (carrying over packagingType)
      const updatedRecordItems = scannableItems.reduce((acc: any[], item) => {
        const existing = acc.find(x => x.productName === item.productName && x.boxName === item.boxName);
        if (existing) {
          existing.quantity = (existing.quantity || 0) + 1;
        } else {
          acc.push({
            productName: item.productName,
            sku: item.sku,
            quantity: 1,
            boxName: item.boxName,
            packagingType: item.packagingType || "Box"
          });
        }
        return acc;
      }, []);

      await update(listRef, {
        status: "Packed",
        invoiceNo,
        dispatchId: dispId,
        dispatchBarcode: finalDispatchBarcode, // Save the new 15-digit barcode
        boxBarcodes,
        lrNo,
        bails: totalBoxes, // Save the total box/bail count
        items: updatedRecordItems, 
        dispatchedAt: Date.now(),
        dispatchedBy: userData?.name || user?.name || "System"
      });

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
          totalBoxes: currentBoxIndex,
          items: scannableItems.map(i => ({ 
            productName: i.productName, 
            sku: i.sku, 
            boxName: i.boxName, 
            packagingType: i.packagingType 
          })),
          boxMapping: scannableItems.map(i => ({ p: i.productName, b: i.boxName }))
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
        <BtnGhost onClick={onClose}>Cancel</BtnGhost>
        <BtnPrimary onClick={handleDispatch} disabled={!selectedList || saving}>
          {saving ? "Finalizing..." : "Finalize Dispatch"}
        </BtnPrimary>
      </PageHeader>

      {!selectedList ? (
        <Card style={{ padding: 0, overflow: "hidden" }}>
           <div className="p-6 border-b border-slate-100">
             <h3 className="text-base font-semibold text-slate-800">Pending Packing Lists</h3>
             <p className="text-xs text-slate-500 mt-1">Select a packing list to finalize its dispatch.</p>
           </div>
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
        </Card>
      ) : (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Side: Scanning Table */}
            <div className="lg:col-span-2">
               <Card style={{ padding: 0, overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}>
                  <div className="p-4 border-b border-slate-100 bg-white flex justify-between items-center">
                     <div>
                        <h4 className="text-sm font-bold text-slate-800">Dispatch Scanning</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[11px] text-slate-500">Assign to:</p>
                          <select 
                            value={packageType} 
                            onChange={(e) => setPackageType(e.target.value as "Box" | "Bale")}
                            className="text-[11px] bg-slate-100 border-none rounded px-2 py-0.5 font-bold text-indigo-600 outline-none cursor-pointer"
                          >
                            <option value="Box">Box</option>
                            <option value="Bale">Bale</option>
                          </select>
                        </div>
                     </div>
                     <div className="flex items-center gap-4">
                        {selectedIds.size > 0 && (
                           <button 
                             onClick={handleCreateBox}
                             className="bg-indigo-600 text-white text-[10px] font-bold px-4 py-2.5 rounded-lg hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100 animate-in zoom-in duration-200"
                           >
                              Create {packageType} {currentBoxName} ({selectedIds.size} selected)
                           </button>
                        )}
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-1.5 px-3">
                           <span className="text-[10px] font-bold text-slate-400 uppercase mr-3">Next {packageType}</span>
                           <span className="text-sm font-black text-slate-600">{currentBoxName}</span>
                        </div>
                     </div>
                  </div>

                  <div className="max-h-[550px] overflow-y-auto bg-[#f8fafc]/50">
                     <table className="w-full border-collapse">
                        <thead className="bg-[#f8fafc] sticky top-0 z-10 border-b border-slate-200">
                           <tr>
                              <th className="px-4 py-3 text-center w-10">
                                 <input 
                                    type="checkbox" 
                                    checked={selectedIds.size === scannableItems.length && scannableItems.length > 0}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                 />
                              </th>
                              <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Item Details</th>
                              <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scanner Input</th>
                              <th className="px-6 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">Box No.</th>
                              <th className="px-6 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">Verify</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {scannableItems.map((item, idx) => (
                             <tr key={item.id} className={`group hover:bg-white transition-colors ${item.isPacked ? 'bg-emerald-50/10' : selectedIds.has(item.id) ? 'bg-indigo-50/30' : ''}`}>
                                <td className="px-4 py-3 text-center">
                                   <input 
                                      type="checkbox"
                                      disabled={item.isPacked || !!item.boxName}
                                      checked={selectedIds.has(item.id)}
                                      onChange={() => toggleSelection(item.id)}
                                      className={`w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 ${item.isPacked || !!item.boxName ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}`}
                                   />
                                </td>
                                <td className="px-6 py-4">
                                   <div className="text-[13px] font-semibold text-slate-700">{item.productName}</div>
                                   <div className="text-[10px] font-mono text-slate-400 mt-0.5">SKU: {item.sku}</div>
                                </td>
                                <td className="px-6 py-4 w-[280px]">
                                   <div className="relative group/field">
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
                                         className={`w-full bg-white border-[1.5px] font-mono text-[13px] p-2.5 px-4 rounded-none outline-none transition-all ${
                                           item.isPacked 
                                            ? 'border-emerald-200 bg-emerald-50/20 text-emerald-700 shadow-inner' 
                                            : item.scannedValue.length > 0
                                              ? 'border-rose-200 bg-rose-50/20 text-rose-700 focus:border-rose-500 ring-rose-50/50'
                                              : 'border-slate-200 text-slate-700 shadow-sm focus:border-indigo-500 focus:ring-4 ring-indigo-50/50'
                                         }`}
                                      />
                                      {item.isPacked ? (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                           <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-200">
                                              <svg width="10" height="8" viewBox="0 0 12 9" fill="none">
                                                 <path d="M1 4.5L4.5 8L11 1.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                              </svg>
                                           </div>
                                        </div>
                                      ) : item.scannedValue.length > 0 && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                           <div className="w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center shadow-lg shadow-rose-200">
                                              <span className="text-white text-[10px] font-bold">✕</span>
                                           </div>
                                        </div>
                                      )}
                                   </div>
                                </td>
                                 <td className="px-6 py-4 text-center">
                                    {item.boxName ? (
                                       <div className="flex flex-col items-center gap-1">
                                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 font-bold text-[11px] px-2.5 py-1 rounded-md border border-amber-100">
                                             {item.boxName}
                                          </span>
                                          {boxBarcodes[item.boxName] && (
                                            <span className="text-[9px] font-mono text-slate-400">
                                              {boxBarcodes[item.boxName]}
                                            </span>
                                          )}
                                       </div>
                                    ) : (
                                       <span className="text-[10px] text-slate-300 font-medium italic">Pending</span>
                                    )}
                                 </td>
                                <td className="px-6 py-4 text-center">
                                   <div className={`w-8 h-8 mx-auto rounded-lg flex items-center justify-center transition-all ${
                                      item.isPacked 
                                      ? 'text-emerald-500 scale-110' 
                                      : 'text-slate-200 group-hover:text-slate-300'
                                   }`}>
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
               </Card>
            </div>

            {/* Right Side: Options & Finalize */}
            <div className="space-y-6">
               <Card style={{ padding: 24 }}>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                       <h3 className="text-lg font-semibold text-slate-800">{selectedList.partyName}</h3>
                       <p className="text-xs text-slate-500">#{selectedList.id.slice(-6)}</p>
                    </div>
                    <button onClick={() => setSelectedList(null)} className="text-xs text-slate-400 hover:text-red-500 transition-colors">Change List</button>
                  </div>

                  <div className="space-y-6">
                     <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Invoice Number</label>
                        <input 
                           type="text"
                           placeholder="INV-"
                           value={invoiceNo}
                           onChange={(e) => setInvoiceNo(e.target.value)}
                           className="w-full p-2.5 rounded-none border border-slate-200 bg-white text-sm font-semibold outline-none focus:border-indigo-500 transition-all shadow-sm"
                        />
                        <p className="text-[10px] text-slate-400 mt-2 italic px-1">This field is mandatory for tracking.</p>
                     </div>

                     {/* Verification Section */}
                     <div className="pt-4 border-t border-slate-100">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Security Verification</label>
                        <input 
                           type="password"
                           placeholder="Enter MPIN"
                           maxLength={6}
                           value={pin}
                           onChange={(e) => setPin(e.target.value)}
                           className="w-full p-3 rounded-none border border-slate-200 bg-slate-50 text-center text-lg font-bold outline-none focus:border-indigo-500 transition-all mb-4"
                        />
                        <BtnPrimary 
                           onClick={handleDispatch} 
                           disabled={saving || !scannableItems.every(i => i.isPacked) || pin.length < 4 || !invoiceNo.trim()}
                           style={{ padding: "14px", fontSize: 14, width: "100%", justifyContent: "center" }}
                        >
                           {saving ? "Processing..." : "Complete Verification"}
                        </BtnPrimary>
                        <p className="text-[10px] text-center text-slate-400 mt-3 px-4">Ensure all {scannableItems.length} items are scanned and your MPIN is correct to finalize.</p>
                     </div>
                  </div>
               </Card>
            </div>
         </div>
      )}
    </div>
  );
}
