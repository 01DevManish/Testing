import { ref, set } from "@/app/lib/dynamoRtdbCompat";
import { db } from "./firebase";
import { DataEntity, isDataEntity } from "./dataEntities";

const SIGNAL_ROOT = "syncSignals";

export const touchDataSignal = async (entity: DataEntity): Promise<void> => {
  try {
    await set(ref(db, `${SIGNAL_ROOT}/${entity}`), Date.now());
  } catch (error) {
    console.warn(`[DataSignals] Failed to touch signal for ${entity}.`, error);
  }
};

export const touchDataSignalByName = async (entity: string): Promise<void> => {
  if (!isDataEntity(entity)) return;
  await touchDataSignal(entity);
};


