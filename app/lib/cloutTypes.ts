export type CloutItemKind = "folder" | "file";

export interface CloutItem {
  id: string;
  kind: CloutItemKind;
  name: string;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
  createdByUid: string;
  createdByName: string;
  size?: number;
  mimeType?: string;
  extension?: string;
  s3Key?: string;
  s3Url?: string;
}
