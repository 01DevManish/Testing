/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const ExcelJS = require("exceljs");
const nodemailer = require("nodemailer");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");

if (process.env.NODE_ENV === "production" || process.env.CI) {
  dotenv.config({ path: path.join(process.cwd(), ".env") });
} else {
  dotenv.config({ path: path.join(process.cwd(), ".env.local") });
  dotenv.config({ path: path.join(process.cwd(), ".env") });
}

const REGION = process.env.AWS_REGION || "ap-south-1";
const DATA_TABLE_NAME = process.env.DYNAMO_DATA_TABLE || "eurus-data";
const REPORT_DIR = path.join(process.cwd(), "scripts", "reports", "daily");

const REPORT_SMTP_HOST = process.env.REPORT_SMTP_HOST || "smtp.gmail.com";
const REPORT_SMTP_PORT = Number(process.env.REPORT_SMTP_PORT || 465);
const REPORT_SMTP_SECURE = String(process.env.REPORT_SMTP_SECURE || "true") !== "false";
const REPORT_SMTP_USER = (process.env.REPORT_SMTP_USER || "").trim();
const REPORT_SMTP_PASS = (process.env.REPORT_SMTP_PASS || "").trim();
const REPORT_MAIL_FROM = (process.env.REPORT_MAIL_FROM || REPORT_SMTP_USER).trim();
const REPORT_MAIL_TO = (process.env.REPORT_MAIL_TO || "").trim();
const REPORT_MAIL_CC = (process.env.REPORT_MAIL_CC || "").trim();
const REPORT_SKIP_IF_MISSING = String(process.env.REPORT_SKIP_IF_MISSING || "false") === "true";

const makeClientConfig = () => {
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    return {
      region: REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    };
  }
  return { region: REGION };
};

const partitionFor = (entity) => `DATA#${entity}`;

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const formatDateTime = (value) => {
  if (!value) return "";
  const n = Number(value);
  const date = Number.isFinite(n) && n > 1000000000 ? new Date(n) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false });
};

const dateStamp = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
};

const fetchEntityRows = async (docClient, entity) => {
  const partition = partitionFor(entity);
  const rows = [];
  let lastKey;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: DATA_TABLE_NAME,
        KeyConditionExpression: "#p = :pk AND begins_with(#s, :sk)",
        ExpressionAttributeNames: {
          "#p": "partition",
          "#s": "timestamp_id",
        },
        ExpressionAttributeValues: {
          ":pk": partition,
          ":sk": "ITEM#",
        },
        ScanIndexForward: false,
        ExclusiveStartKey: lastKey,
      })
    );

    (result.Items || []).forEach((item) => {
      if (item && typeof item.payload === "object" && item.payload) rows.push(item.payload);
    });

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return rows;
};

const addSheet = (workbook, name, columns, rows) => {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width || Math.max(14, String(col.header).length + 2),
  }));
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  header.alignment = { vertical: "middle" };
  header.height = 20;

  rows.forEach((row) => sheet.addRow(row));
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = { vertical: "top", wrapText: true };
    });
  });

  columns.forEach((col, idx) => {
    const column = sheet.getColumn(idx + 1);
    let max = String(col.header).length;
    column.eachCell({ includeEmpty: false }, (cell) => {
      max = Math.max(max, String(cell.value || "").length);
    });
    column.width = Math.min(Math.max(max + 2, col.width || 12), col.maxWidth || 45);
  });
};

const writeWorkbook = async (fileName, sheets) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Eurus ERP";
  workbook.created = new Date();
  workbook.modified = new Date();
  sheets.forEach((sheet) => addSheet(workbook, sheet.name, sheet.columns, sheet.rows));
  const filePath = path.join(REPORT_DIR, fileName);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
};

const asArray = (value) => Array.isArray(value) ? value : [];
const firstImage = (row) =>
  row.imageUrl || asArray(row.imageUrls).find((url) => typeof url === "string" && url.trim()) || "";

const buildInventoryReport = (inventory, stamp) => {
  const rows = inventory.map((p) => ({
    sku: p.sku || "",
    productName: p.productName || "",
    category: p.category || "",
    collection: p.collection || "",
    brand: p.brand || "",
    size: p.size || "",
    unit: p.unit || "",
    stock: Number(p.stock || 0),
    status: p.status || "",
    price: Number(p.price || 0),
    wholesalePrice: Number(p.wholesalePrice || 0),
    costPrice: Number(p.costPrice || 0),
    barcode: p.barcode || "",
    imageUrl: firstImage(p),
    updatedAt: formatDateTime(p.updatedAt),
    id: p.id || "",
  }));

  return writeWorkbook(`Inventory_Report_${stamp}.xlsx`, [{
    name: "Inventory",
    columns: [
      { header: "SKU", key: "sku", width: 18 },
      { header: "Product Name", key: "productName", width: 34, maxWidth: 60 },
      { header: "Category", key: "category", width: 18 },
      { header: "Collection", key: "collection", width: 18 },
      { header: "Brand", key: "brand", width: 18 },
      { header: "Size", key: "size", width: 12 },
      { header: "Unit", key: "unit", width: 10 },
      { header: "Stock", key: "stock", width: 10 },
      { header: "Status", key: "status", width: 14 },
      { header: "Price", key: "price", width: 12 },
      { header: "Wholesale Price", key: "wholesalePrice", width: 16 },
      { header: "Cost Price", key: "costPrice", width: 14 },
      { header: "Barcode", key: "barcode", width: 18 },
      { header: "Image URL", key: "imageUrl", width: 30, maxWidth: 70 },
      { header: "Updated At", key: "updatedAt", width: 22 },
      { header: "ID", key: "id", width: 24 },
    ],
    rows,
  }]);
};

const buildRetailDispatchReport = (dispatches, stamp) => {
  const summaryRows = dispatches.map((d) => ({
    id: d.id || "",
    partyName: d.partyName || d.customer?.name || "",
    status: d.status || "",
    paymentStatus: d.paymentStatus || "",
    dispatchDate: d.dispatchDate || "",
    transporterName: d.transporterName || "",
    bails: d.bails || "",
    totalProducts: asArray(d.products).length,
    totalQuantity: asArray(d.products).reduce((sum, p) => sum + Number(p.quantity || 0), 0),
    stockDeducted: d.stockDeducted ? "Yes" : "No",
    createdAt: formatDateTime(d.createdAt),
    updatedAt: formatDateTime(d.updatedAt),
  }));

  const itemRows = [];
  dispatches.forEach((d) => {
    asArray(d.products).forEach((p) => {
      itemRows.push({
        dispatchId: d.id || "",
        partyName: d.partyName || d.customer?.name || "",
        status: d.status || "",
        sku: p.sku || "",
        productName: p.productName || p.name || "",
        quantity: Number(p.quantity || 0),
        price: Number(p.price || 0),
        packed: p.packed ? "Yes" : "No",
        productId: p.id || p.productId || "",
      });
    });
  });

  return writeWorkbook(`Retail_Dispatch_Report_${stamp}.xlsx`, [
    {
      name: "Dispatches",
      columns: [
        { header: "Dispatch ID", key: "id", width: 24 },
        { header: "Party Name", key: "partyName", width: 28 },
        { header: "Status", key: "status", width: 14 },
        { header: "Payment Status", key: "paymentStatus", width: 16 },
        { header: "Dispatch Date", key: "dispatchDate", width: 18 },
        { header: "Transporter", key: "transporterName", width: 22 },
        { header: "Bails", key: "bails", width: 10 },
        { header: "Product Lines", key: "totalProducts", width: 14 },
        { header: "Total Quantity", key: "totalQuantity", width: 15 },
        { header: "Stock Deducted", key: "stockDeducted", width: 16 },
        { header: "Created At", key: "createdAt", width: 22 },
        { header: "Updated At", key: "updatedAt", width: 22 },
      ],
      rows: summaryRows,
    },
    {
      name: "Dispatch Items",
      columns: [
        { header: "Dispatch ID", key: "dispatchId", width: 24 },
        { header: "Party Name", key: "partyName", width: 28 },
        { header: "Status", key: "status", width: 14 },
        { header: "SKU", key: "sku", width: 18 },
        { header: "Product Name", key: "productName", width: 34 },
        { header: "Quantity", key: "quantity", width: 12 },
        { header: "Price", key: "price", width: 12 },
        { header: "Packed", key: "packed", width: 10 },
        { header: "Product ID", key: "productId", width: 24 },
      ],
      rows: itemRows,
    },
  ]);
};

const buildPackingListReport = (packingLists, stamp) => {
  const summaryRows = packingLists.map((p) => ({
    id: p.id || "",
    dispatchId: p.dispatchId || "",
    dispatchNo: p.dispatchNo || "",
    partyName: p.partyName || "",
    status: p.status || "",
    assignedTo: p.assignedToName || p.assignedTo || "",
    transporterName: p.transporterName || p.transporter || "",
    lrNo: p.lrNo || "",
    invoiceNo: p.invoiceNo || "",
    totalBoxes: p.totalBoxes || asArray(p.boxes).length || "",
    totalItems: asArray(p.items || p.products).reduce((sum, item) => sum + Number(item.quantity || item.qty || 0), 0),
    partyCity: p.partyCity || p.district || "",
    partyAddress: p.partyAddress || "",
    createdAt: formatDateTime(p.createdAt),
    dispatchedAt: formatDateTime(p.dispatchedAt),
    updatedAt: formatDateTime(p.updatedAt),
  }));

  const itemRows = [];
  packingLists.forEach((list) => {
    asArray(list.items || list.products).forEach((item) => {
      itemRows.push({
        packingListId: list.id || "",
        dispatchId: list.dispatchId || "",
        partyName: list.partyName || "",
        sku: item.sku || "",
        productName: item.productName || item.name || "",
        quantity: Number(item.quantity || item.qty || 0),
        boxNo: item.boxNo || item.boxId || "",
        productId: item.productId || item.id || "",
      });
    });
  });

  return writeWorkbook(`Packing_List_Report_${stamp}.xlsx`, [
    {
      name: "Packing Lists",
      columns: [
        { header: "Packing List ID", key: "id", width: 24 },
        { header: "Dispatch ID", key: "dispatchId", width: 20 },
        { header: "Dispatch No", key: "dispatchNo", width: 16 },
        { header: "Party Name", key: "partyName", width: 28 },
        { header: "Status", key: "status", width: 14 },
        { header: "Assigned To", key: "assignedTo", width: 20 },
        { header: "Transporter", key: "transporterName", width: 22 },
        { header: "LR No", key: "lrNo", width: 16 },
        { header: "Invoice No", key: "invoiceNo", width: 16 },
        { header: "Total Boxes", key: "totalBoxes", width: 14 },
        { header: "Total Items", key: "totalItems", width: 14 },
        { header: "City", key: "partyCity", width: 16 },
        { header: "Address", key: "partyAddress", width: 34, maxWidth: 70 },
        { header: "Created At", key: "createdAt", width: 22 },
        { header: "Dispatched At", key: "dispatchedAt", width: 22 },
        { header: "Updated At", key: "updatedAt", width: 22 },
      ],
      rows: summaryRows,
    },
    {
      name: "Packing Items",
      columns: [
        { header: "Packing List ID", key: "packingListId", width: 24 },
        { header: "Dispatch ID", key: "dispatchId", width: 20 },
        { header: "Party Name", key: "partyName", width: 28 },
        { header: "SKU", key: "sku", width: 18 },
        { header: "Product Name", key: "productName", width: 34 },
        { header: "Quantity", key: "quantity", width: 12 },
        { header: "Box No", key: "boxNo", width: 12 },
        { header: "Product ID", key: "productId", width: 24 },
      ],
      rows: itemRows,
    },
  ]);
};

const buildPartyRatesReport = (partyRates, stamp) => {
  const partyRows = partyRates.map((p) => ({
    id: p.id || "",
    partyName: p.partyName || "",
    companyName: p.billTo?.companyName || "",
    traderName: p.billTo?.traderName || "",
    gstNo: p.billTo?.gstNo || "",
    panNo: p.billTo?.panNo || "",
    contactNo: p.billTo?.contactNo || "",
    email: p.billTo?.email || "",
    district: p.billTo?.district || "",
    state: p.billTo?.state || "",
    pincode: p.billTo?.pincode || "",
    address: p.billTo?.address || "",
    transporter: p.transporter || "",
    rateLines: asArray(p.rates).length,
    updatedAt: formatDateTime(p.updatedAt),
  }));

  const rateRows = [];
  partyRates.forEach((party) => {
    asArray(party.rates).forEach((rate) => {
      rateRows.push({
        partyId: party.id || "",
        partyName: party.partyName || "",
        sku: rate.sku || "",
        productName: rate.productName || "",
        rate: Number(rate.rate || 0),
        packagingType: rate.packagingType || "",
        packagingCost: Number(rate.packagingCost || 0),
        discount: Number(rate.discount || 0),
        discountType: rate.discountType || "",
        gstRate: Number(rate.gstRate || 0),
      });
    });
  });

  return writeWorkbook(`Party_Wise_Rates_Report_${stamp}.xlsx`, [
    {
      name: "Parties",
      columns: [
        { header: "Party ID", key: "id", width: 24 },
        { header: "Party Name", key: "partyName", width: 28 },
        { header: "Company Name", key: "companyName", width: 28 },
        { header: "Trader Name", key: "traderName", width: 24 },
        { header: "GST No", key: "gstNo", width: 18 },
        { header: "PAN No", key: "panNo", width: 16 },
        { header: "Contact No", key: "contactNo", width: 18 },
        { header: "Email", key: "email", width: 22 },
        { header: "District", key: "district", width: 16 },
        { header: "State", key: "state", width: 16 },
        { header: "Pincode", key: "pincode", width: 12 },
        { header: "Address", key: "address", width: 34, maxWidth: 70 },
        { header: "Transporter", key: "transporter", width: 22 },
        { header: "Rate Lines", key: "rateLines", width: 12 },
        { header: "Updated At", key: "updatedAt", width: 22 },
      ],
      rows: partyRows,
    },
    {
      name: "Rates",
      columns: [
        { header: "Party ID", key: "partyId", width: 24 },
        { header: "Party Name", key: "partyName", width: 28 },
        { header: "SKU", key: "sku", width: 18 },
        { header: "Product Name", key: "productName", width: 34 },
        { header: "Rate", key: "rate", width: 12 },
        { header: "Packaging Type", key: "packagingType", width: 18 },
        { header: "Packaging Cost", key: "packagingCost", width: 16 },
        { header: "Discount", key: "discount", width: 12 },
        { header: "Discount Type", key: "discountType", width: 15 },
        { header: "GST Rate", key: "gstRate", width: 12 },
      ],
      rows: rateRows,
    },
  ]);
};

const validateMailConfig = () => {
  const missing = [];
  if (!REPORT_SMTP_USER) missing.push("REPORT_SMTP_USER");
  if (!REPORT_SMTP_PASS) missing.push("REPORT_SMTP_PASS");
  if (!REPORT_MAIL_TO) missing.push("REPORT_MAIL_TO");
  if (!REPORT_MAIL_FROM) missing.push("REPORT_MAIL_FROM");
  if (!missing.length) return true;

  const message = `Missing report mail config: ${missing.join(", ")}`;
  if (REPORT_SKIP_IF_MISSING) {
    console.warn(`${message}. Skipping email send.`);
    return false;
  }
  throw new Error(message);
};

const sendEmail = async (attachments, counts, stamp) => {
  if (!validateMailConfig()) return null;

  const transporter = nodemailer.createTransport({
    host: REPORT_SMTP_HOST,
    port: REPORT_SMTP_PORT,
    secure: REPORT_SMTP_SECURE,
    auth: {
      user: REPORT_SMTP_USER,
      pass: REPORT_SMTP_PASS,
    },
  });

  const subject = `Daily Eurus Excel Reports - ${stamp}`;
  const text = [
    "Daily Eurus Excel reports are attached.",
    "",
    `Inventory rows: ${counts.inventory}`,
    `Retail dispatch rows: ${counts.dispatches}`,
    `Packing list rows: ${counts.packingLists}`,
    `Party wise rows: ${counts.partyRates}`,
    "",
    `Generated from DynamoDB table: ${DATA_TABLE_NAME}`,
  ].join("\n");

  return transporter.sendMail({
    from: REPORT_MAIL_FROM,
    to: REPORT_MAIL_TO,
    cc: REPORT_MAIL_CC || undefined,
    subject,
    text,
    attachments: attachments.map((filePath) => ({
      filename: path.basename(filePath),
      path: filePath,
    })),
  });
};

async function run() {
  ensureDir(REPORT_DIR);
  const stamp = dateStamp();
  const dynamo = new DynamoDBClient(makeClientConfig());
  const docClient = DynamoDBDocumentClient.from(dynamo, {
    marshallOptions: { removeUndefinedValues: true },
  });

  console.log(`Generating daily Excel reports from "${DATA_TABLE_NAME}" in "${REGION}"...`);
  const [inventory, dispatches, packingLists, partyRates] = await Promise.all([
    fetchEntityRows(docClient, "inventory"),
    fetchEntityRows(docClient, "dispatches"),
    fetchEntityRows(docClient, "packingLists"),
    fetchEntityRows(docClient, "partyRates"),
  ]);

  const counts = {
    inventory: inventory.length,
    dispatches: dispatches.length,
    packingLists: packingLists.length,
    partyRates: partyRates.length,
  };
  console.log("Counts:", counts);

  const attachments = [];
  attachments.push(await buildInventoryReport(inventory, stamp));
  attachments.push(await buildRetailDispatchReport(dispatches, stamp));
  attachments.push(await buildPackingListReport(packingLists, stamp));
  attachments.push(await buildPartyRatesReport(partyRates, stamp));

  console.log("Generated files:");
  attachments.forEach((filePath) => console.log(`- ${filePath}`));

  if (process.argv.includes("--no-email")) {
    console.log("Email skipped because --no-email was provided.");
    return;
  }

  const info = await sendEmail(attachments, counts, stamp);
  if (info) {
    console.log(`Email sent: ${info.messageId}`);
  }
}

run().catch((error) => {
  console.error("Daily report failed:", error);
  process.exit(1);
});
