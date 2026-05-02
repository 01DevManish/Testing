// Testing/relations.ts
import { relations } from "drizzle-orm";
import {
  users,
  permissions,
  userPermissions,
  userFcmTokens,
  userPresence,

  brands,
  categories,
  collections,
  itemGroups,
  transporters,
  parties,
  managedBoxParties,

  inventoryProducts,
  inventoryProductBarcodes,
  inventoryProductPricing,
  inventoryStock,
  inventoryImages,
  inventoryAdjustments,

  partyRateHeaders,
  partyRateItems,

  dispatches,
  dispatchItems,
  packingLists,
  packingListItems,

  tasks,

  ermLeads,
  ermLeadCalls,
  ermOrders,
  ermOrderItems,

  activities,
  activityMetadata,
  notifications,

  chatRooms,
  chatMessages,
  userChatIndex,

  cloutFolders,
  cloutItems,

  inventoryImageMap,

  syncSignals,
  migrationAuditLogs,
} from "./schema";

/* ================= USERS ================= */

export const usersRelations = relations(users, ({ many }) => ({
  userPermissions: many(userPermissions),
  fcmTokens: many(userFcmTokens),
  presenceRows: many(userPresence),

  managedBoxPartiesCreated: many(managedBoxParties),

  inventoryProductsCreated: many(inventoryProducts, { relationName: "inventoryProductsCreatedBy" }),
  inventoryProductsUpdated: many(inventoryProducts, { relationName: "inventoryProductsUpdatedBy" }),
  inventoryAdjustments: many(inventoryAdjustments),

  dispatchesAssigned: many(dispatches, { relationName: "dispatchesAssignedTo" }),
  dispatchesCreated: many(dispatches, { relationName: "dispatchesCreatedBy" }),

  packingListsAssigned: many(packingLists, { relationName: "packingListsAssignedTo" }),
  packingListsCreated: many(packingLists, { relationName: "packingListsCreatedBy" }),
  packingListsDispatched: many(packingLists, { relationName: "packingListsDispatchedBy" }),
  packingListsUpdated: many(packingLists, { relationName: "packingListsUpdatedBy" }),

  tasksAssigned: many(tasks, { relationName: "tasksAssignedTo" }),
  tasksCreated: many(tasks, { relationName: "tasksCreatedBy" }),
  tasksCompletionRequestedBy: many(tasks, { relationName: "tasksCompletionRequestedBy" }),

  leadsAssigned: many(ermLeads, { relationName: "leadsAssignedTo" }),
  leadCallsByUser: many(ermLeadCalls),
  ermOrdersByEmployee: many(ermOrders),

  activitiesByUser: many(activities),
  notificationsAsRecipient: many(notifications, { relationName: "notificationsRecipient" }),
  notificationsAsActor: many(notifications, { relationName: "notificationsActor" }),

  chatRoomsAsA: many(chatRooms, { relationName: "chatRoomsUserA" }),
  chatRoomsAsB: many(chatRooms, { relationName: "chatRoomsUserB" }),
  chatMessages: many(chatMessages),
  chatIndexAsUser: many(userChatIndex, { relationName: "chatIndexUser" }),
  chatIndexAsPeer: many(userChatIndex, { relationName: "chatIndexPeer" }),

  cloutFoldersCreated: many(cloutFolders),
  cloutItemsCreated: many(cloutItems),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  userPermissions: many(userPermissions),
}));

export const userPermissionsRelations = relations(userPermissions, ({ one }) => ({
  user: one(users, {
    fields: [userPermissions.userId],
    references: [users.id],
  }),
  permission: one(permissions, {
    fields: [userPermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const userFcmTokensRelations = relations(userFcmTokens, ({ one }) => ({
  user: one(users, {
    fields: [userFcmTokens.userId],
    references: [users.id],
  }),
}));

export const userPresenceRelations = relations(userPresence, ({ one }) => ({
  user: one(users, {
    fields: [userPresence.userId],
    references: [users.id],
  }),
}));

/* ================= MASTERS ================= */

export const brandsRelations = relations(brands, ({ many }) => ({
  products: many(inventoryProducts),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(inventoryProducts),
  itemGroups: many(itemGroups),
}));

export const collectionsRelations = relations(collections, ({ many }) => ({
  products: many(inventoryProducts),
}));

export const itemGroupsRelations = relations(itemGroups, ({ one, many }) => ({
  category: one(categories, {
    fields: [itemGroups.categoryId],
    references: [categories.id],
  }),
  products: many(inventoryProducts),
}));

export const transportersRelations = relations(transporters, ({ many }) => ({
  partyRateHeaders: many(partyRateHeaders),
  packingLists: many(packingLists),
}));

export const partiesRelations = relations(parties, ({ many }) => ({
  managedBoxPartyLinks: many(managedBoxParties),
  partyRateHeadersForParty: many(partyRateHeaders, { relationName: "rateHeaderParty" }),
  partyRateHeadersBillTo: many(partyRateHeaders, { relationName: "rateHeaderBillTo" }),
  partyRateHeadersShipTo: many(partyRateHeaders, { relationName: "rateHeaderShipTo" }),
  dispatches: many(dispatches),
  packingLists: many(packingLists),
}));

export const managedBoxPartiesRelations = relations(managedBoxParties, ({ one }) => ({
  party: one(parties, {
    fields: [managedBoxParties.partyId],
    references: [parties.id],
  }),
  createdByUser: one(users, {
    fields: [managedBoxParties.createdBy],
    references: [users.id],
  }),
}));

/* ================= INVENTORY ================= */

export const inventoryProductsRelations = relations(inventoryProducts, ({ one, many }) => ({
  brand: one(brands, {
    fields: [inventoryProducts.brandId],
    references: [brands.id],
  }),
  category: one(categories, {
    fields: [inventoryProducts.categoryId],
    references: [categories.id],
  }),
  collection: one(collections, {
    fields: [inventoryProducts.collectionId],
    references: [collections.id],
  }),
  itemGroup: one(itemGroups, {
    fields: [inventoryProducts.itemGroupId],
    references: [itemGroups.id],
  }),
  createdByUser: one(users, {
    relationName: "inventoryProductsCreatedBy",
    fields: [inventoryProducts.createdBy],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    relationName: "inventoryProductsUpdatedBy",
    fields: [inventoryProducts.updatedBy],
    references: [users.id],
  }),

  barcodes: many(inventoryProductBarcodes),
  pricingRows: many(inventoryProductPricing),
  stockRows: many(inventoryStock),
  images: many(inventoryImages),
  adjustments: many(inventoryAdjustments),

  partyRateItems: many(partyRateItems),
  dispatchItems: many(dispatchItems),
  packingListItems: many(packingListItems),
  ermOrderItems: many(ermOrderItems),
  imageMapRows: many(inventoryImageMap),
}));

export const inventoryProductBarcodesRelations = relations(inventoryProductBarcodes, ({ one }) => ({
  product: one(inventoryProducts, {
    fields: [inventoryProductBarcodes.productId],
    references: [inventoryProducts.id],
  }),
}));

export const inventoryProductPricingRelations = relations(inventoryProductPricing, ({ one }) => ({
  product: one(inventoryProducts, {
    fields: [inventoryProductPricing.productId],
    references: [inventoryProducts.id],
  }),
}));

export const inventoryStockRelations = relations(inventoryStock, ({ one }) => ({
  product: one(inventoryProducts, {
    fields: [inventoryStock.productId],
    references: [inventoryProducts.id],
  }),
}));

export const inventoryImagesRelations = relations(inventoryImages, ({ one }) => ({
  product: one(inventoryProducts, {
    fields: [inventoryImages.productId],
    references: [inventoryProducts.id],
  }),
}));

export const inventoryAdjustmentsRelations = relations(inventoryAdjustments, ({ one }) => ({
  product: one(inventoryProducts, {
    fields: [inventoryAdjustments.productId],
    references: [inventoryProducts.id],
  }),
  adjustedByUser: one(users, {
    fields: [inventoryAdjustments.adjustedBy],
    references: [users.id],
  }),
}));

/* ================= PARTY RATES ================= */

export const partyRateHeadersRelations = relations(partyRateHeaders, ({ one, many }) => ({
  party: one(parties, {
    relationName: "rateHeaderParty",
    fields: [partyRateHeaders.partyId],
    references: [parties.id],
  }),
  billToParty: one(parties, {
    relationName: "rateHeaderBillTo",
    fields: [partyRateHeaders.billToPartyId],
    references: [parties.id],
  }),
  shipToParty: one(parties, {
    relationName: "rateHeaderShipTo",
    fields: [partyRateHeaders.shipToPartyId],
    references: [parties.id],
  }),
  transporter: one(transporters, {
    fields: [partyRateHeaders.transporterId],
    references: [transporters.id],
  }),
  items: many(partyRateItems),
}));

export const partyRateItemsRelations = relations(partyRateItems, ({ one }) => ({
  header: one(partyRateHeaders, {
    fields: [partyRateItems.partyRateHeaderId],
    references: [partyRateHeaders.id],
  }),
  product: one(inventoryProducts, {
    fields: [partyRateItems.productId],
    references: [inventoryProducts.id],
  }),
}));

/* ================= DISPATCH / PACKING ================= */

export const dispatchesRelations = relations(dispatches, ({ one, many }) => ({
  party: one(parties, {
    fields: [dispatches.partyId],
    references: [parties.id],
  }),
  assignedToUser: one(users, {
    relationName: "dispatchesAssignedTo",
    fields: [dispatches.assignedTo],
    references: [users.id],
  }),
  createdByUser: one(users, {
    relationName: "dispatchesCreatedBy",
    fields: [dispatches.createdBy],
    references: [users.id],
  }),
  items: many(dispatchItems),
  packingLists: many(packingLists),
}));

export const dispatchItemsRelations = relations(dispatchItems, ({ one }) => ({
  dispatch: one(dispatches, {
    fields: [dispatchItems.dispatchId],
    references: [dispatches.id],
  }),
  product: one(inventoryProducts, {
    fields: [dispatchItems.productId],
    references: [inventoryProducts.id],
  }),
}));

export const packingListsRelations = relations(packingLists, ({ one, many }) => ({
  dispatch: one(dispatches, {
    fields: [packingLists.dispatchId],
    references: [dispatches.id],
  }),
  party: one(parties, {
    fields: [packingLists.partyId],
    references: [parties.id],
  }),
  transporter: one(transporters, {
    fields: [packingLists.transporterId],
    references: [transporters.id],
  }),
  assignedToUser: one(users, {
    relationName: "packingListsAssignedTo",
    fields: [packingLists.assignedTo],
    references: [users.id],
  }),
  createdByUser: one(users, {
    relationName: "packingListsCreatedBy",
    fields: [packingLists.createdBy],
    references: [users.id],
  }),
  dispatchedByUser: one(users, {
    relationName: "packingListsDispatchedBy",
    fields: [packingLists.dispatchedBy],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    relationName: "packingListsUpdatedBy",
    fields: [packingLists.updatedBy],
    references: [users.id],
  }),
  items: many(packingListItems),
}));

export const packingListItemsRelations = relations(packingListItems, ({ one }) => ({
  packingList: one(packingLists, {
    fields: [packingListItems.packingListId],
    references: [packingLists.id],
  }),
  product: one(inventoryProducts, {
    fields: [packingListItems.productId],
    references: [inventoryProducts.id],
  }),
}));

/* ================= TASKS ================= */

export const tasksRelations = relations(tasks, ({ one }) => ({
  assignedToUser: one(users, {
    relationName: "tasksAssignedTo",
    fields: [tasks.assignedTo],
    references: [users.id],
  }),
  createdByUser: one(users, {
    relationName: "tasksCreatedBy",
    fields: [tasks.createdBy],
    references: [users.id],
  }),
  completionRequestedByUser: one(users, {
    relationName: "tasksCompletionRequestedBy",
    fields: [tasks.completionRequestedBy],
    references: [users.id],
  }),
}));

/* ================= ERM / CRM ================= */

export const ermLeadsRelations = relations(ermLeads, ({ one, many }) => ({
  assignedToUser: one(users, {
    relationName: "leadsAssignedTo",
    fields: [ermLeads.assignedTo],
    references: [users.id],
  }),
  calls: many(ermLeadCalls),
  orders: many(ermOrders),
}));

export const ermLeadCallsRelations = relations(ermLeadCalls, ({ one }) => ({
  lead: one(ermLeads, {
    fields: [ermLeadCalls.leadId],
    references: [ermLeads.id],
  }),
  calledByUser: one(users, {
    fields: [ermLeadCalls.calledBy],
    references: [users.id],
  }),
}));

export const ermOrdersRelations = relations(ermOrders, ({ one, many }) => ({
  lead: one(ermLeads, {
    fields: [ermOrders.leadId],
    references: [ermLeads.id],
  }),
  employee: one(users, {
    fields: [ermOrders.employeeId],
    references: [users.id],
  }),
  items: many(ermOrderItems),
}));

export const ermOrderItemsRelations = relations(ermOrderItems, ({ one }) => ({
  order: one(ermOrders, {
    fields: [ermOrderItems.ermOrderId],
    references: [ermOrders.id],
  }),
  product: one(inventoryProducts, {
    fields: [ermOrderItems.productId],
    references: [inventoryProducts.id],
  }),
}));

/* ================= ACTIVITIES / NOTIFS ================= */

export const activitiesRelations = relations(activities, ({ one, many }) => ({
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
  metadataRows: many(activityMetadata),
}));

export const activityMetadataRelations = relations(activityMetadata, ({ one }) => ({
  activity: one(activities, {
    fields: [activityMetadata.activityId],
    references: [activities.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  recipientUser: one(users, {
    relationName: "notificationsRecipient",
    fields: [notifications.userId],
    references: [users.id],
  }),
  actorUser: one(users, {
    relationName: "notificationsActor",
    fields: [notifications.actorId],
    references: [users.id],
  }),
}));

/* ================= CHAT ================= */

export const chatRoomsRelations = relations(chatRooms, ({ one, many }) => ({
  userA: one(users, {
    relationName: "chatRoomsUserA",
    fields: [chatRooms.userAId],
    references: [users.id],
  }),
  userB: one(users, {
    relationName: "chatRoomsUserB",
    fields: [chatRooms.userBId],
    references: [users.id],
  }),
  messages: many(chatMessages),
  userIndexes: many(userChatIndex),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  room: one(chatRooms, {
    fields: [chatMessages.roomId],
    references: [chatRooms.id],
  }),
  sender: one(users, {
    fields: [chatMessages.senderId],
    references: [users.id],
  }),
}));

export const userChatIndexRelations = relations(userChatIndex, ({ one }) => ({
  user: one(users, {
    relationName: "chatIndexUser",
    fields: [userChatIndex.userId],
    references: [users.id],
  }),
  peer: one(users, {
    relationName: "chatIndexPeer",
    fields: [userChatIndex.peerUserId],
    references: [users.id],
  }),
  room: one(chatRooms, {
    fields: [userChatIndex.roomId],
    references: [chatRooms.id],
  }),
}));

/* ================= CLOUT ================= */

export const cloutFoldersRelations = relations(cloutFolders, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [cloutFolders.createdBy],
    references: [users.id],
  }),
  items: many(cloutItems),
}));

export const cloutItemsRelations = relations(cloutItems, ({ one }) => ({
  folder: one(cloutFolders, {
    fields: [cloutItems.folderId],
    references: [cloutFolders.id],
  }),
  createdByUser: one(users, {
    fields: [cloutItems.createdBy],
    references: [users.id],
  }),
}));

/* ================= EXTRA ================= */

export const inventoryImageMapRelations = relations(inventoryImageMap, ({ one }) => ({
  product: one(inventoryProducts, {
    fields: [inventoryImageMap.productId],
    references: [inventoryProducts.id],
  }),
}));

export const syncSignalsRelations = relations(syncSignals, () => ({}));
export const migrationAuditLogsRelations = relations(migrationAuditLogs, () => ({}));
