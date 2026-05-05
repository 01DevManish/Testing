export const DATA_ENTITIES = [
  "inventory",
  "inventoryAdjustments",
  "cloutItems",
  "partyRates",
  "brands",
  "categories",
  "collections",
  "itemGroups",
  "dispatches",
  "packingLists",
  "parties",
  "transporters",
  "tasks",
  "ermLeads",
  "ermLeadCalls",
  "ermLeadActivities",
  "usersMeta",
  "ermOrders",
] as const;

export type DataEntity = (typeof DATA_ENTITIES)[number];

export const isDataEntity = (value: string): value is DataEntity =>
  (DATA_ENTITIES as readonly string[]).includes(value);

export const dataPartitionKey = (entity: DataEntity): string => `DATA#${entity}`;
export const dataSortKey = (id: string): string => `ITEM#${id}`;
