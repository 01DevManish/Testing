// Testing/schema.ts
import {
  pgTable,
  text,
  integer,
  boolean,
  numeric,
  bigint,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/* =========================
   1) USERS + PERMISSIONS
========================= */

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(), // internal id
    uid: text("uid").notNull(), // auth uid
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull().default("employee"),
    dispatchPin: text("dispatch_pin"),
    profilePic: text("profile_pic"),
    requiresPasswordChange: boolean("requires_password_change").notNull().default(false),
    passwordUpdatedAt: bigint("password_updated_at", { mode: "number" }),
    passwordUpdatedBy: text("password_updated_by"),
    crmWorkspaceCreated: boolean("crm_workspace_created").notNull().default(false),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [
    uniqueIndex("users_uid_uq").on(t.uid),
    uniqueIndex("users_email_uq").on(t.email),
    index("users_role_idx").on(t.role),
  ]
);

export const permissions = pgTable(
  "permissions",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    module: text("module"),
    submodule: text("submodule"),
    action: text("action"),
    label: text("label"),
  },
  (t) => [uniqueIndex("permissions_code_uq").on(t.code)]
);

export const userPermissions = pgTable(
  "user_permissions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    permissionId: text("permission_id").notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [
    uniqueIndex("user_permissions_user_perm_uq").on(t.userId, t.permissionId),
    index("user_permissions_user_idx").on(t.userId),
    index("user_permissions_perm_idx").on(t.permissionId),
  ]
);

export const userFcmTokens = pgTable(
  "user_fcm_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    token: text("token").notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("user_fcm_tokens_uq").on(t.userId, t.token)]
);

export const userPresence = pgTable(
  "user_presence",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    status: text("status"), // online/offline/away
    lastSeenAt: bigint("last_seen_at", { mode: "number" }),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("user_presence_user_uq").on(t.userId)]
);

/* =========================
   2) MASTER DATA
========================= */

export const brands = pgTable("brands", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }),
});

export const collections = pgTable("collections", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  collectionCode: text("collection_code"),
  description: text("description"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }),
});

export const itemGroups = pgTable("item_groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  categoryId: text("category_id"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }),
});

export const transporters = pgTable("transporters", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }),
});

export const parties = pgTable("parties", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  city: text("city"),
  state: text("state"),
  pincode: text("pincode"),
  gstin: text("gstin"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const managedBoxParties = pgTable("managed_box_parties", {
  id: text("id").primaryKey(),
  partyId: text("party_id").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

/* =========================
   3) INVENTORY
========================= */

export const inventoryProducts = pgTable(
  "inventory_products",
  {
    id: text("id").primaryKey(),
    sku: text("sku").notNull(),
    productName: text("product_name").notNull(),
    description: text("description"),
    brandId: text("brand_id"),
    categoryId: text("category_id"),
    collectionId: text("collection_id"),
    itemGroupId: text("item_group_id"),
    size: text("size"),
    unit: text("unit"),
    styleId: text("style_id"),
    status: text("status"),
    createdBy: text("created_by"),
    createdByName: text("created_by_name"),
    updatedBy: text("updated_by"),
    updatedByName: text("updated_by_name"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("inventory_products_sku_uq").on(t.sku)]
);

export const inventoryProductBarcodes = pgTable(
  "inventory_product_barcodes",
  {
    id: text("id").primaryKey(),
    productId: text("product_id").notNull(),
    barcode: text("barcode").notNull(),
    barcodeSku: text("barcode_sku"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("inventory_product_barcodes_barcode_uq").on(t.barcode)]
);

export const inventoryProductPricing = pgTable("inventory_product_pricing", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  hsnCode: text("hsn_code"),
  gstRate: numeric("gst_rate", { precision: 10, scale: 2 }),
  costPrice: numeric("cost_price", { precision: 14, scale: 2 }),
  wholesalePrice: numeric("wholesale_price", { precision: 14, scale: 2 }),
  price: numeric("price", { precision: 14, scale: 2 }),
  mrp: numeric("mrp", { precision: 14, scale: 2 }),
  effectiveFrom: bigint("effective_from", { mode: "number" }),
  effectiveTo: bigint("effective_to", { mode: "number" }),
});

export const inventoryStock = pgTable("inventory_stock", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  stockQty: numeric("stock_qty", { precision: 14, scale: 3 }).notNull().default("0"),
  minStockQty: numeric("min_stock_qty", { precision: 14, scale: 3 }).default("0"),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const inventoryImages = pgTable("inventory_images", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  imageUrl: text("image_url").notNull(),
  isPrimary: boolean("is_primary").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const inventoryAdjustments = pgTable("inventory_adjustments", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  adjustmentType: text("adjustment_type").notNull(),
  quantityBefore: numeric("quantity_before", { precision: 14, scale: 3 }),
  quantityChange: numeric("quantity_change", { precision: 14, scale: 3 }).notNull(),
  quantityAfter: numeric("quantity_after", { precision: 14, scale: 3 }),
  reason: text("reason"),
  note: text("note"),
  adjustedBy: text("adjusted_by"),
  adjustedByName: text("adjusted_by_name"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

/* =========================
   4) PARTY RATES
========================= */

export const partyRateHeaders = pgTable("party_rate_headers", {
  id: text("id").primaryKey(),
  partyId: text("party_id").notNull(),
  billToPartyId: text("bill_to_party_id"),
  shipToPartyId: text("ship_to_party_id"),
  sameAsBillTo: boolean("same_as_bill_to").notNull().default(false),
  transporterId: text("transporter_id"),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const partyRateItems = pgTable("party_rate_items", {
  id: text("id").primaryKey(),
  partyRateHeaderId: text("party_rate_header_id").notNull(),
  productId: text("product_id").notNull(),
  rate: numeric("rate", { precision: 14, scale: 2 }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

/* =========================
   5) DISPATCH + PACKING
========================= */

export const dispatches = pgTable("dispatches", {
  id: text("id").primaryKey(),
  orderRef: text("order_ref"),
  partyId: text("party_id"),
  partyName: text("party_name"),
  status: text("status"),
  assignedTo: text("assigned_to"),
  assignedToName: text("assigned_to_name"),
  createdBy: text("created_by"),
  createdByName: text("created_by_name"),
  dispatchedAt: bigint("dispatched_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const dispatchItems = pgTable("dispatch_items", {
  id: text("id").primaryKey(),
  dispatchId: text("dispatch_id").notNull(),
  productId: text("product_id"),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  rate: numeric("rate", { precision: 14, scale: 2 }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const packingLists = pgTable("packing_lists", {
  id: text("id").primaryKey(),
  dispatchId: text("dispatch_id"),
  invoiceNo: text("invoice_no"),
  partyId: text("party_id"),
  partyName: text("party_name"),
  partyCity: text("party_city"),
  partyAddress: text("party_address"),
  transporterId: text("transporter_id"),
  lrNo: text("lr_no"),
  bails: integer("bails"),
  packagingType: text("packaging_type"),
  status: text("status"),
  stockDeducted: boolean("stock_deducted").default(false),
  dispatchBarcode: text("dispatch_barcode"),
  packingPdfUrl: text("packing_pdf_url"),
  assignedTo: text("assigned_to"),
  assignedToName: text("assigned_to_name"),
  createdBy: text("created_by"),
  createdById: text("created_by_id"),
  dispatchedBy: text("dispatched_by"),
  dispatchedAt: bigint("dispatched_at", { mode: "number" }),
  cancelledAt: bigint("cancelled_at", { mode: "number" }),
  updatedBy: text("updated_by"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const packingListItems = pgTable("packing_list_items", {
  id: text("id").primaryKey(),
  packingListId: text("packing_list_id").notNull(),
  productId: text("product_id"),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  rate: numeric("rate", { precision: 14, scale: 2 }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

/* =========================
   6) TASKS
========================= */

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority"),
  status: text("status"),
  assignedTo: text("assigned_to"),
  assignedToName: text("assigned_to_name"),
  assignedToRole: text("assigned_to_role"),
  createdBy: text("created_by"),
  createdByName: text("created_by_name"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }),
  completionRequested: boolean("completion_requested").default(false),
  completionRequestedAt: bigint("completion_requested_at", { mode: "number" }),
  completionRequestedBy: text("completion_requested_by"),
  completionApprovalStatus: text("completion_approval_status"),
  lastWorkingStatus: text("last_working_status"),
  updatedAt: bigint("updated_at", { mode: "number" }),
});

/* =========================
   7) ERM / CRM
========================= */

export const ermLeads = pgTable("erm_leads", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  company: text("company"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  pincode: text("pincode"),
  source: text("source"),
  status: text("status"),
  assignedTo: text("assigned_to"),
  assignedToName: text("assigned_to_name"),
  notes: text("notes"),
  nextFollowUpAt: bigint("next_follow_up_at", { mode: "number" }),
  callAttemptCount: integer("call_attempt_count").default(0),
  lastOutcome: text("last_outcome"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const ermLeadCalls = pgTable("erm_lead_calls", {
  id: text("id").primaryKey(),
  leadId: text("lead_id").notNull(),
  calledBy: text("called_by"),
  calledByName: text("called_by_name"),
  callType: text("call_type"),
  outcome: text("outcome"),
  followUpMode: text("follow_up_mode"),
  priority: text("priority"),
  nextAction: text("next_action"),
  notes: text("notes"),
  scheduledAt: bigint("scheduled_at", { mode: "number" }),
  calledAt: bigint("called_at", { mode: "number" }).notNull(),
});

export const ermOrders = pgTable("erm_orders", {
  id: text("id").primaryKey(),
  leadId: text("lead_id"),
  leadName: text("lead_name"),
  employeeId: text("employee_id"),
  employeeName: text("employee_name"),
  status: text("status"),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const ermOrderItems = pgTable("erm_order_items", {
  id: text("id").primaryKey(),
  ermOrderId: text("erm_order_id").notNull(),
  productId: text("product_id"),
  productName: text("product_name"),
  sku: text("sku"),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  price: numeric("price", { precision: 14, scale: 2 }).notNull(),
  lineTotal: numeric("line_total", { precision: 14, scale: 2 }),
});

/* =========================
   8) ACTIVITY + NOTIFICATIONS
========================= */

export const activities = pgTable("activities", {
  id: text("id").primaryKey(),
  type: text("type"),
  action: text("action"),
  title: text("title"),
  description: text("description"),
  userId: text("user_id"),
  userName: text("user_name"),
  userRole: text("user_role"),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
});

export const activityMetadata = pgTable("activity_metadata", {
  id: text("id").primaryKey(),
  activityId: text("activity_id").notNull(),
  metaKey: text("meta_key").notNull(),
  metaValue: text("meta_value"),
});

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  actorId: text("actor_id"),
  actorName: text("actor_name"),
  type: text("type"),
  title: text("title"),
  message: text("message"),
  link: text("link"),
  isRead: boolean("is_read").notNull().default(false),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  createdAt: bigint("created_at", { mode: "number" }),
});

/* =========================
   9) CHAT
========================= */

export const chatRooms = pgTable(
  "chat_rooms",
  {
    id: text("id").primaryKey(),
    roomKey: text("room_key").notNull(),
    userAId: text("user_a_id").notNull(),
    userBId: text("user_b_id").notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("chat_rooms_room_key_uq").on(t.roomKey)]
);

export const chatMessages = pgTable("chat_messages", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull(),
  senderId: text("sender_id").notNull(),
  senderName: text("sender_name"),
  messageText: text("message_text").notNull(),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  createdAt: bigint("created_at", { mode: "number" }),
});

export const userChatIndex = pgTable(
  "user_chat_index",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    peerUserId: text("peer_user_id").notNull(),
    roomId: text("room_id").notNull(),
    lastMessage: text("last_message"),
    lastReadAt: bigint("last_read_at", { mode: "number" }),
    unreadCount: integer("unread_count").notNull().default(0),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("user_chat_index_user_peer_uq").on(t.userId, t.peerUserId)]
);

/* =========================
   10) CL0UT + EXTRA MAPS
========================= */

export const cloutFolders = pgTable("clout_folders", {
  id: text("id").primaryKey(),
  parentFolderId: text("parent_folder_id"),
  name: text("name").notNull(),
  createdBy: text("created_by"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }),
});

export const cloutItems = pgTable("clout_items", {
  id: text("id").primaryKey(),
  folderId: text("folder_id"),
  title: text("title"),
  description: text("description"),
  fileUrl: text("file_url"),
  thumbnailUrl: text("thumbnail_url"),
  tagsCsv: text("tags_csv"),
  createdBy: text("created_by"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }),
});

export const inventoryImageMap = pgTable("inventory_image_map", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  sku: text("sku"),
  imageUrl: text("image_url").notNull(),
  sortOrder: integer("sort_order").default(0),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

/* =========================
   11) SYSTEM TABLES
========================= */

export const syncSignals = pgTable("sync_signals", {
  id: text("id").primaryKey(),
  entityName: text("entity_name").notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const migrationAuditLogs = pgTable("migration_audit_logs", {
  id: text("id").primaryKey(),
  sourceEntity: text("source_entity").notNull(),
  sourceId: text("source_id"),
  targetTable: text("target_table").notNull(),
  targetId: text("target_id"),
  status: text("status").notNull(), // success/failed/skipped
  errorMessage: text("error_message"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
