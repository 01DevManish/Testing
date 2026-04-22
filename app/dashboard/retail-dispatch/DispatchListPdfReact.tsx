import React from "react";
import { Document, Image, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import { generateDispatchBarcode, renderBarcodeToBase64 } from "../../lib/barcodeUtils";
import { PackingList } from "./types";
import { firestoreApi } from "./data";

export interface DispatchItem {
  srNo: number;
  productCategory: string;
  collectionName: string;
  skuId: string;
  packingType: string;
  quantity: number;
  boxBailId: string;
}

export interface DispatchListData {
  traderName: string;
  traderAddress: string;
  city: string;
  contact: string;
  gst: string;
  pan: string;
  barcode?: string;
  barcodeImage?: string;
  dispatchNo: string;
  date: string;
  time: string;
  invoiceNo: string | number;
  lrNo: string;
  dispatchedBy: string;
  countOfBoxBail: number;
  transporterName: string;
  items: DispatchItem[];
  preparedBy: string;
}

const C = {
  black: "#000000",
  border: "#000000",
};

const COMPANY_LOGO_URL = "/dispatch-list-logo.png?v=2";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9.6,
    paddingTop: 6,
    paddingBottom: 26,
    paddingHorizontal: 24,
    color: C.black,
    backgroundColor: "#ffffff",
  },
  headerWrapper: { alignItems: "center", marginBottom: 0 },
  logoImage: { width: 330, height: 106, objectFit: "contain", marginBottom: 0 },
  headerAddress: { fontSize: 11.4, fontFamily: "Helvetica-Bold", textAlign: "center", marginTop: -22, marginBottom: 5 },
  headerContact: { fontSize: 10.2, textAlign: "center", marginTop: -1, marginBottom: 5 },
  headerLine2: { width: "100%", height: 1.2, backgroundColor: C.black, marginBottom: 0.5 },
  title: { fontSize: 17, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 6, letterSpacing: 1 },

  topRow: {
    flexDirection: "row",
    marginBottom: 9,
  },
  billToBox: {
    flex: 1,
    padding: 8,
    borderWidth: 1.2,
    borderColor: C.border,
    marginRight: 7,
  },
  billToLabel: { fontSize: 9.1, fontFamily: "Helvetica-Bold", marginBottom: 1 },
  billToName: { fontSize: 11.2, fontFamily: "Helvetica-Bold", marginBottom: 1 },
  billToLine: { fontSize: 9.4, marginBottom: 1, lineHeight: 1.1 },
  billToGst: { fontSize: 9.4, fontFamily: "Helvetica-Bold", marginTop: 1, lineHeight: 1.1 },
  billToBodyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  billToTextBlock: {
    flex: 1,
    paddingRight: 7,
  },
  barcodeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 },
  barcodeBlock: {
    alignItems: "center",
    width: 100,
    marginTop: -3,
    marginLeft: 5,
  },
  barcodeImage: {
    width: 90,
    height: 22,
    objectFit: "contain",
  },
  barcodeNumber: { width: "100%", fontSize: 8.6, fontFamily: "Helvetica-Bold", marginTop: 0, textAlign: "center" },

  dispatchBox: { flex: 1, padding: 8, borderWidth: 1.2, borderColor: C.border },
  dispatchTitle: {
    fontSize: 10.2,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  dispatchRow: { flexDirection: "row", marginBottom: 1 },
  dispatchLabel: { fontSize: 9.3, width: 112 },
  dispatchValue: { fontSize: 9.3, fontFamily: "Helvetica-Bold", flex: 1 },

  table: {
    borderWidth: 1.2,
    borderColor: C.border,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1.2,
    borderBottomColor: C.border,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.8,
    borderBottomColor: C.border,
    minHeight: 19,
  },
  tableTotalRow: {
    flexDirection: "row",
    borderTopWidth: 1.2,
    borderTopColor: C.border,
    backgroundColor: "#ffffff",
  },

  colSrNo: { width: 38, borderRightWidth: 0.8, borderRightColor: C.border, padding: 4, justifyContent: "center", alignItems: "center" },
  colCategory: { width: 110, borderRightWidth: 0.8, borderRightColor: C.border, padding: 4, justifyContent: "center", alignItems: "center" },
  colCollection: { width: 105, borderRightWidth: 0.8, borderRightColor: C.border, padding: 4, justifyContent: "center", alignItems: "center" },
  colSku: { width: 92, borderRightWidth: 0.8, borderRightColor: C.border, padding: 4, justifyContent: "center", alignItems: "center" },
  colPacking: { width: 88, borderRightWidth: 0.8, borderRightColor: C.border, padding: 4, justifyContent: "center", alignItems: "center" },
  colQty: { width: 62, borderRightWidth: 0.8, borderRightColor: C.border, padding: 4, justifyContent: "center", alignItems: "center" },
  colBoxBail: { width: 52, padding: 4, justifyContent: "center", alignItems: "center" },

  tableHeaderText: {
    fontSize: 8.7,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  tableCellText: { fontSize: 8.7, fontFamily: "Helvetica-Bold", textAlign: "center" },
  tableCellTextSr: { fontSize: 8.7, fontFamily: "Helvetica-Bold", textAlign: "center", width: "100%", lineHeight: 1.1 },

  totalLabelCell: {
    flex: 1,
    padding: 4,
    alignItems: "flex-end",
    borderRightWidth: 0.8,
    borderRightColor: C.border,
  },
  totalLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
    paddingRight: 4,
  },
  totalQtyCell: {
    width: 62,
    borderRightWidth: 0.8,
    borderRightColor: C.border,
    padding: 4,
    alignItems: "center",
  },
  totalQtyText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  totalBoxCell: {
    width: 52,
    padding: 4,
  },

  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 6,
  },
  footerBlock: { width: "45%" },
  footerBlockRight: { width: "45%", alignItems: "flex-end" },
  footerPrepared: { fontSize: 10, marginBottom: 14 },
  footerPreparedBold: { fontFamily: "Helvetica-Bold" },
  footerSignature: { fontSize: 10 },
  footerUrl: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 8,
    fontSize: 7,
    color: "#000000",
    textAlign: "center",
  },
});

const ROWS_PER_PAGE = 20;

const DispatchRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.dispatchRow}>
    <Text style={styles.dispatchLabel}>{label}</Text>
    <Text style={styles.dispatchValue}>{value}</Text>
  </View>
);

const chunkItems = <T,>(arr: T[], size: number): T[][] => {
  if (!arr.length) return [[]];
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const DispatchListPDF: React.FC<{ data: DispatchListData }> = ({ data }) => {
  const totalQty = data.items.reduce((sum, item) => sum + item.quantity, 0);
  const pages = chunkItems(data.items, ROWS_PER_PAGE);

  return (
    <Document>
      {pages.map((pageItems, pageIndex) => {
        const emptyRows = Math.max(0, ROWS_PER_PAGE - pageItems.length);
        return (
          <Page key={`page-${pageIndex + 1}`} size="A4" style={styles.page}>
            <View style={styles.headerWrapper}>
              <Image src={COMPANY_LOGO_URL} style={styles.logoImage} />
              <Text style={styles.headerAddress}>Address: Plot No. 263, Sector 25 Part 2, HUDA, Panipat, Haryana - 132103</Text>
              <Text style={styles.headerContact}>Email: sales@euruslifestyle.in  |  Contact No: 7678099909  |  GST: 06AAKFE6046J1Z9</Text>
              <View style={styles.headerLine2} />
            </View>

            <Text style={styles.title}>DISPATCH LIST</Text>

            <View style={styles.topRow}>
              <View style={styles.billToBox}>
                <View style={styles.barcodeRow}>
                  <View style={styles.billToTextBlock}>
                    <Text style={styles.billToLabel}>Bill To:</Text>
                    <Text style={styles.billToName}>{data.traderName}</Text>
                  </View>
                  <View style={styles.barcodeBlock}>
                    {data.barcodeImage ? <Image src={data.barcodeImage} style={styles.barcodeImage} /> : null}
                    <Text style={styles.barcodeNumber}>{data.barcode ?? ""}</Text>
                  </View>
                </View>
                <Text style={styles.billToLine}>Trader: {data.traderName}</Text>
                <Text style={styles.billToLine}>{data.traderAddress}</Text>
                <Text style={styles.billToLine}>{data.city}</Text>
                <Text style={styles.billToLine}>Contact: {data.contact}</Text>
                <Text style={styles.billToGst}>GST: {data.gst} | PAN: {data.pan}</Text>
              </View>

              <View style={styles.dispatchBox}>
                <Text style={styles.dispatchTitle}>Dispatch Details:-</Text>
                <DispatchRow label="Dispatch No:" value={data.dispatchNo} />
                <DispatchRow label="Date:" value={data.date} />
                <DispatchRow label="Time:" value={data.time} />
                <DispatchRow label="Invoice No:" value={String(data.invoiceNo)} />
                <DispatchRow label="Dispatched By:" value={data.dispatchedBy} />
                <DispatchRow label="Count of Box / Bail:" value={String(data.countOfBoxBail)} />
                <DispatchRow label="Transporter Name:" value={data.transporterName} />
                <DispatchRow label="LR No:" value={data.lrNo} />
              </View>
            </View>

            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <View style={styles.colSrNo}><Text style={styles.tableHeaderText}>Sr. No.</Text></View>
                <View style={styles.colCategory}><Text style={styles.tableHeaderText}>Product Category</Text></View>
                <View style={styles.colCollection}><Text style={styles.tableHeaderText}>Collection Name</Text></View>
                <View style={styles.colSku}><Text style={styles.tableHeaderText}>SKU ID</Text></View>
                <View style={styles.colPacking}><Text style={styles.tableHeaderText}>Packing Type</Text></View>
                <View style={styles.colQty}><Text style={styles.tableHeaderText}>Quantity</Text></View>
                <View style={styles.colBoxBail}><Text style={styles.tableHeaderText}>Box / Bail ID</Text></View>
              </View>

              {pageItems.map((item) => (
                <View key={`${pageIndex}-${item.srNo}-${item.skuId}`} style={styles.tableRow}>
                  <View style={styles.colSrNo}><Text style={styles.tableCellTextSr}>{item.srNo}.</Text></View>
                  <View style={styles.colCategory}><Text style={styles.tableCellText}>{item.productCategory}</Text></View>
                  <View style={styles.colCollection}><Text style={styles.tableCellText}>{item.collectionName}</Text></View>
                  <View style={styles.colSku}><Text style={styles.tableCellText}>{item.skuId}</Text></View>
                  <View style={styles.colPacking}><Text style={styles.tableCellText}>{item.packingType}</Text></View>
                  <View style={styles.colQty}><Text style={styles.tableCellText}>{item.quantity}</Text></View>
                  <View style={styles.colBoxBail}><Text style={styles.tableCellText}>{item.boxBailId}</Text></View>
                </View>
              ))}

              {Array.from({ length: emptyRows }).map((_, i) => (
                <View key={`empty-${pageIndex}-${i}`} style={styles.tableRow}>
                  <View style={styles.colSrNo}><Text style={styles.tableCellTextSr}> </Text></View>
                  <View style={styles.colCategory}><Text style={styles.tableCellText}> </Text></View>
                  <View style={styles.colCollection}><Text style={styles.tableCellText}> </Text></View>
                  <View style={styles.colSku}><Text style={styles.tableCellText}> </Text></View>
                  <View style={styles.colPacking}><Text style={styles.tableCellText}> </Text></View>
                  <View style={styles.colQty}><Text style={styles.tableCellText}> </Text></View>
                  <View style={styles.colBoxBail}><Text style={styles.tableCellText}> </Text></View>
                </View>
              ))}

              <View style={styles.tableTotalRow}>
                <View style={styles.totalLabelCell}><Text style={styles.totalLabel}>TOTAL:-</Text></View>
                <View style={styles.totalQtyCell}><Text style={styles.totalQtyText}>{totalQty}</Text></View>
                <View style={styles.totalBoxCell}><Text style={styles.tableCellText}> </Text></View>
              </View>
            </View>

            <View style={styles.footer}>
              <View style={styles.footerBlock}>
                <Text style={styles.footerPrepared}>
                  Prepared By: <Text style={styles.footerPreparedBold}>{data.preparedBy}</Text>
                </Text>
                <Text style={styles.footerSignature}>Signature &amp; Date:</Text>
              </View>
              <View style={styles.footerBlockRight}>
                <Text style={styles.footerPrepared}>Received By:</Text>
                <Text style={styles.footerSignature}>Signature &amp; Date:</Text>
              </View>
            </View>

            <Text style={styles.footerUrl}>Generated from: https://epanel​.euruslifestyle​.in/dashboard/retail-dispatch</Text>
          </Page>
        );
      })}
    </Document>
  );
};

const toSafeText = (v: unknown, fallback = "-") => {
  const t = String(v ?? "").trim();
  return t || fallback;
};

const formatDateTime = (value?: number | string) => {
  const d = new Date(value || Date.now());
  return {
    date: d.toLocaleDateString("en-IN"),
    time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
};

type DispatchSourceItem = {
  productName?: string;
  boxName?: string;
  category?: string;
  collectionName?: string;
  sku?: string;
  packagingType?: string;
  packingType?: string;
  quantity?: number;
};

type DispatchSource = Omit<PackingList, "items"> & {
  dispatchNo?: string;
  dispatchBarcode?: string;
  traderName?: string;
  contactNo?: string;
  gstNo?: string;
  panNo?: string;
  district?: string;
  state?: string;
  pincode?: string;
  packagingType?: string;
  packingType?: string;
  items?: DispatchSourceItem[];
};

const normalize = (value?: string) => String(value || "").trim().toLowerCase();

const resolveItemsFromInventory = async (items: DispatchSourceItem[]): Promise<DispatchSourceItem[]> => {
  if (!items.length) return items;
  try {
    const inventoryRows = await firestoreApi.getInventoryProducts();
    if (!inventoryRows.length) return items;

    const bySku: Record<string, { category?: string; collection?: string }> = {};
    const byName: Record<string, { category?: string; collection?: string }> = {};

    inventoryRows.forEach((data) => {
      const sku = normalize(String(data.sku || ""));
      const name = normalize(String(data.productName || ""));
      const category = String(data.category || "").trim();
      const collection = String(data.collection || "").trim();
      const payload = { category, collection };
      if (sku) bySku[sku] = payload;
      if (name) byName[name] = payload;
    });

    return items.map((item) => {
      const skuKey = normalize(item.sku);
      const nameKey = normalize(item.productName);
      const inv = bySku[skuKey] || byName[nameKey];
      return {
        ...item,
        category: item.category || inv?.category || "",
        collectionName: item.collectionName || inv?.collection || "",
      };
    });
  } catch {
    return items;
  }
};

export const mapDispatchListToReactPdfData = (list: DispatchSource): DispatchListData => {
  const { date, time } = formatDateTime(list?.dispatchedAt || list?.createdAt);
  const items = Array.isArray(list?.items) ? list.items : [];
  const totalBoxes =
    new Set(
      items
        .map((i) => String(i?.boxName || "").trim())
        .filter((name) => !!name && name !== "-" && name.toUpperCase() !== "UNASSIGNED")
    ).size || Number(list?.bails || 0);
  const totalItems = items.reduce((acc, item) => acc + Number(item?.quantity || 1), 0);
  const dispatchCode = toSafeText(
    list?.dispatchBarcode || generateDispatchBarcode(String(list?.dispatchNo || list?.dispatchId || "0000"), totalBoxes, totalItems),
    ""
  );

  return {
    traderName: toSafeText(list?.partyName || list?.traderName, "Unknown Party"),
    traderAddress: toSafeText(list?.partyAddress, ""),
    city: [list?.partyCity || list?.district, list?.state, list?.pincode ? `- ${list.pincode}` : ""].filter(Boolean).join(", "),
    contact: toSafeText(list?.contactNo || list?.partyPhone, "-"),
    gst: toSafeText(list?.gstNo, "-"),
    pan: toSafeText(list?.panNo, "-"),
    barcode: dispatchCode,
    barcodeImage: dispatchCode ? renderBarcodeToBase64(dispatchCode) : "",
    dispatchNo: toSafeText(list?.dispatchNo || list?.dispatchId, "-"),
    date,
    time,
    invoiceNo: list?.invoiceNo ?? "-",
    lrNo: toSafeText(list?.lrNo, "-"),
    dispatchedBy: toSafeText(list?.assignedToName || list?.dispatchedBy, "-"),
    countOfBoxBail: Number(totalBoxes || 0),
    transporterName: toSafeText(list?.transporter, "-"),
    items: items.map((item, idx) => ({
      srNo: idx + 1,
      productCategory: toSafeText(item?.category, ""),
      collectionName: toSafeText(item?.collectionName, ""),
      skuId: toSafeText(item?.sku, "N/A"),
      packingType: toSafeText(item?.packagingType || item?.packingType || list?.packagingType || list?.packingType || "Box"),
      quantity: Number(item?.quantity || 1),
      boxBailId: toSafeText(item?.boxName, "-"),
    })),
    preparedBy: toSafeText(list?.assignedToName || list?.dispatchedBy, "-"),
  };
};

export const generateReactDispatchListPdf = async (list: DispatchSource): Promise<void> => {
  const resolvedItems = await resolveItemsFromInventory(Array.isArray(list.items) ? list.items : []);
  const data = mapDispatchListToReactPdfData({ ...list, items: resolvedItems });
  const blob = await pdf(<DispatchListPDF data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (win) win.focus();
  else alert("Popup blocked. Please allow popups to view the PDF.");
  setTimeout(() => URL.revokeObjectURL(url), 8000);
};
