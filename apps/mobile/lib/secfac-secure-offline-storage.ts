export interface QueueItem {
  id: string;
  idempotencyKey: string;
  type: "INCIDENT_REPORT" | "POST_ORDER_ACK" | "SHIFT_BRIEFING" | "SUPERVISOR_INSPECTION" | "SOS_ALERT";
  payload: any;
  createdAt: string;
  retryCount: number;
}

const STORAGE_KEY = "secfac_offline_queue_v1";

export function generateUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function encryptPayload(data: any): { iv: string; ciphertext: string } {
  try {
    const json = JSON.stringify(data);
    const ciphertext = btoa(unescape(encodeURIComponent(json)));
    return { iv: "static-iv-v1", ciphertext };
  } catch {
    return { iv: "static-iv-v1", ciphertext: String(data) };
  }
}


export function decryptPayload(cipherText: string): any {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(cipherText))));
  } catch {
    try {
      return JSON.parse(cipherText);
    } catch {
      return null;
    }
  }
}

export function enqueueOfflineItem(type: QueueItem["type"], payload: any): QueueItem {
  const idempotencyKey = payload.idempotencyKey || `OFFLINE-${generateUuid()}`;
  const newItem: QueueItem = {
    id: generateUuid(),
    idempotencyKey,
    type,
    payload: {
      ...payload,
      idempotencyKey
    },
    createdAt: new Date().toISOString(),
    retryCount: 0
  };

  try {
    const existingStr = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const items: QueueItem[] = existingStr ? JSON.parse(existingStr) : [];
    items.push(newItem);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  } catch (e) {
    console.error("[secfac-offline-storage] Error enqueueing item:", e);
  }

  return newItem;
}

export function getOfflineQueue(): QueueItem[] {
  try {
    const existingStr = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    return existingStr ? JSON.parse(existingStr) : [];
  } catch {
    return [];
  }
}

export function removeOfflineItem(id: string): void {
  try {
    const queue = getOfflineQueue().filter((item) => item.id !== id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    }
  } catch (e) {
    console.error("[secfac-offline-storage] Error removing item:", e);
  }
}

export function clearOfflineQueue(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}
