import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { DATA_TABLE_NAME, docClient } from "./dynamodb";
import { CloutItem } from "./cloutTypes";
import { dataPartitionKey, dataSortKey } from "./dataEntities";

const ENTITY = "cloutItems" as const;

type RawRow = Record<string, unknown>;

const asCloutItem = (input: RawRow): CloutItem | null => {
  if (typeof input.id !== "string" || !input.id.trim()) return null;
  if (input.kind !== "file" && input.kind !== "folder") return null;
  if (typeof input.name !== "string" || !input.name.trim()) return null;
  if (typeof input.createdAt !== "number" || typeof input.updatedAt !== "number") return null;
  if (typeof input.createdByUid !== "string" || typeof input.createdByName !== "string") return null;

  return {
    id: input.id,
    kind: input.kind,
    name: input.name,
    parentId: typeof input.parentId === "string" && input.parentId.trim() ? input.parentId : null,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    createdByUid: input.createdByUid,
    createdByName: input.createdByName,
    size: typeof input.size === "number" ? input.size : undefined,
    mimeType: typeof input.mimeType === "string" ? input.mimeType : undefined,
    extension: typeof input.extension === "string" ? input.extension : undefined,
    s3Key: typeof input.s3Key === "string" ? input.s3Key : undefined,
    s3Url: typeof input.s3Url === "string" ? input.s3Url : undefined,
  };
};

export const listCloutItems = async (): Promise<CloutItem[]> => {
  const partition = dataPartitionKey(ENTITY);
  const rows: CloutItem[] = [];
  let lastKey: Record<string, unknown> | undefined;

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
      const payload = item.payload as RawRow | undefined;
      if (!payload || typeof payload !== "object") return;
      const parsed = asCloutItem(payload);
      if (parsed) rows.push(parsed);
    });

    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return rows;
};

export const getCloutItemById = async (id: string): Promise<CloutItem | null> => {
  const result = await docClient.send(
    new GetCommand({
      TableName: DATA_TABLE_NAME,
      Key: {
        partition: dataPartitionKey(ENTITY),
        timestamp_id: dataSortKey(id),
      },
    })
  );

  const payload = result.Item?.payload as RawRow | undefined;
  if (!payload || typeof payload !== "object") return null;
  return asCloutItem(payload);
};

export const putCloutItem = async (item: CloutItem): Promise<void> => {
  await docClient.send(
    new PutCommand({
      TableName: DATA_TABLE_NAME,
      Item: {
        partition: dataPartitionKey(ENTITY),
        timestamp_id: dataSortKey(item.id),
        entityType: `dataset_${ENTITY}`,
        payload: item,
        updatedAt: Date.now(),
      },
    })
  );
};

export const deleteCloutItemById = async (id: string): Promise<void> => {
  await docClient.send(
    new DeleteCommand({
      TableName: DATA_TABLE_NAME,
      Key: {
        partition: dataPartitionKey(ENTITY),
        timestamp_id: dataSortKey(id),
      },
    })
  );
};
