export interface QueueItem {
  id: string;
  idempotencyKey: string;
  actionType: 'SOS_PANIC' | 'CHECKLIST_DRAFT_SAVE' | 'CHECKLIST_SUBMIT' | 'SCAN_PROOF_CREATE' | 'PATROL_CHECKPOINT_VALIDATE' | 'PATROL_ROUTE_SUBMIT';
  endpoint: string;
  method: string;
  payload: any;
  encryptedPayload?: { iv: string; ciphertext: string };
  createdAt: string;
  lastAttemptAt?: string;
  attemptCount: number;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'NEEDS_ACTION' | 'CONFLICT' | 'DISCARDED';
  lastError?: string;
  assignmentId?: string;
  executionId?: string;
  patrolExecutionId?: string;
  checkpointExecutionId?: string;
  operationType?: string;
  employeeId?: string;
  dependsOn?: string[];
  resolvedServerIds?: Record<string, string>;
  conflictType?: string;
  serverMessage?: string;
  recommendedAction?: string;
  canRetry?: boolean;
  canDiscard?: boolean;
  needsSupervisorReview?: boolean;
  conflictReported?: boolean;

  deviceSessionId?: string;
  deviceLabel?: string;
  devicePlatform?: string;
  clientActionAt?: string;
  networkStatus?: string;
}

import { getOrCreateDeviceSession } from "./secfac-device-session";

const STORAGE_KEY = 'secfac_offline_queue';

function isWindowAvailable(): boolean {
  return typeof window !== 'undefined';
}

export function getQueue(): QueueItem[] {
  if (!isWindowAvailable()) return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse offline queue', e);
    return [];
  }
}

function saveQueue(queue: QueueItem[]): void {
  if (!isWindowAvailable()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to save offline queue', e);
  }
}

export function addQueueItem(item: Omit<QueueItem, 'createdAt' | 'attemptCount' | 'status' | 'idempotencyKey'> & { idempotencyKey?: string }): QueueItem {
  const queue = getQueue();
  let sessionMeta = {};
  try {
    const session = getOrCreateDeviceSession();
    sessionMeta = {
      deviceSessionId: session.deviceSessionId,
      deviceLabel: session.deviceLabel,
      devicePlatform: session.devicePlatform
    };
  } catch (e) {}

  const newItem: QueueItem = {
    ...item,
    idempotencyKey: item.idempotencyKey || createIdempotencyKey(),
    createdAt: new Date().toISOString(),
    clientActionAt: new Date().toISOString(),
    networkStatus: (typeof navigator !== "undefined" && navigator.onLine) ? "ONLINE" : "OFFLINE",
    ...sessionMeta,
    attemptCount: 0,
    status: 'PENDING'
  };
  queue.push(newItem);
  saveQueue(queue);
  return newItem;
}

export function updateQueueItem(id: string, patch: Partial<QueueItem>): void {
  const queue = getQueue();
  const idx = queue.findIndex(item => item.id === id);
  if (idx > -1) {
    queue[idx] = { ...queue[idx], ...patch };
    saveQueue(queue);
  }
}

export function removeQueueItem(id: string): void {
  const queue = getQueue();
  const filtered = queue.filter(item => item.id !== id);
  saveQueue(filtered);
}

export function retryQueueItem(id: string): void {
  updateQueueItem(id, {
    status: 'PENDING',
    attemptCount: 0,
    lastError: undefined
  });
}

export function discardQueueItem(id: string): void {
  updateQueueItem(id, {
    status: 'DISCARDED',
    lastError: 'Discarded by user'
  });
}

export function clearSyncedItems(): void {
  const queue = getQueue();
  const filtered = queue.filter(item => item.status !== 'SYNCED' && item.status !== 'DISCARDED');
  saveQueue(filtered);
}

export function getPendingCount(): number {
  return getQueue().filter(item => item.status === 'PENDING').length;
}

export function createIdempotencyKey(): string {
  if (isWindowAvailable() && typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'ikey-' + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function getQueueItemsForAssignment(assignmentId: string): QueueItem[] {
  return getQueue().filter(item => item.assignmentId === assignmentId);
}

export function getQueueItemsForExecution(executionId: string): QueueItem[] {
  return getQueue().filter(item => item.executionId === executionId);
}

export async function processQueue(): Promise<void> {
  if (!isWindowAvailable() || !navigator.onLine) {
    return;
  }

  let progressMade = true;
  while (progressMade) {
    progressMade = false;
    const queue = getQueue();

    // 1. Find next item that is PENDING and whose dependencies (if any) are all SYNCED.
    const nextItem = queue.find(item => {
      if (item.status !== 'PENDING') return false;
      if (item.dependsOn && item.dependsOn.length > 0) {
        return item.dependsOn.every(depId => {
          const depItem = queue.find(q => q.id === depId);
          return depItem && depItem.status === 'SYNCED';
        });
      }
      return true;
    });

    if (!nextItem) {
      // 2. Check if any pending item has failed dependencies. If so, fail them with clear message.
      const pendingItems = queue.filter(item => item.status === 'PENDING');
      for (const item of pendingItems) {
        if (item.dependsOn && item.dependsOn.length > 0) {
          const failedDep = item.dependsOn.find(depId => {
            const depItem = queue.find(q => q.id === depId);
            return !depItem || depItem.status === 'FAILED' || depItem.status === 'DISCARDED' || depItem.status === 'CONFLICT' || depItem.status === 'NEEDS_ACTION';
          });
          if (failedDep) {
            updateQueueItem(item.id, {
              status: 'FAILED',
              lastError: `Dependency failed (ID: ${failedDep})`
            });
            progressMade = true;
          }
        }
      }
      break;
    }

    // 3. Process nextItem
    progressMade = true;
    updateQueueItem(nextItem.id, { status: 'SYNCING' });

    try {
      let updatedPayload = { ...nextItem.payload };
      let updatedEndpoint = nextItem.endpoint;

      // Replace local queue IDs with real server IDs in payload and URL from dependencies
      if (nextItem.dependsOn && nextItem.dependsOn.length > 0) {
        const resolvedIds: Record<string, string> = {};
        for (const depId of nextItem.dependsOn) {
          const depItem = queue.find(q => q.id === depId);
          if (depItem && depItem.resolvedServerIds) {
            Object.assign(resolvedIds, depItem.resolvedServerIds);
          }
        }

        const replacePlaceholders = (obj: any): any => {
          if (typeof obj === 'string') {
            let val = obj;
            for (const [localId, serverId] of Object.entries(resolvedIds)) {
              if (val === localId) return serverId;
              val = val.replace(new RegExp(localId, 'g'), serverId);
            }
            return val;
          } else if (Array.isArray(obj)) {
            return obj.map(item => replacePlaceholders(item));
          } else if (obj !== null && typeof obj === 'object') {
            const resObj: any = {};
            for (const key of Object.keys(obj)) {
              resObj[key] = replacePlaceholders(obj[key]);
            }
            return resObj;
          }
          return obj;
        };

        updatedPayload = replacePlaceholders(updatedPayload);
        updatedEndpoint = replacePlaceholders(updatedEndpoint);
      }

      const response = await fetch(updatedEndpoint, {
        method: nextItem.method,
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': nextItem.idempotencyKey,
          'X-Secfac-Device-Session-Id': nextItem.deviceSessionId || '',
          'X-Secfac-Device-Label': nextItem.deviceLabel || '',
          'X-Secfac-Device-Platform': nextItem.devicePlatform || '',
          'X-Secfac-Client-Action-At': nextItem.clientActionAt || nextItem.createdAt,
          'X-Secfac-Network-Status': 'OFFLINE',
          'X-Secfac-Queue-Item-Id': nextItem.id,
          'X-Secfac-Sync-Mode': 'OFFLINE_REPLAY'
        },
        body: JSON.stringify(updatedPayload)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const serverId = result.data?.id;
        const resolvedMap: Record<string, string> = {};
        if (serverId) {
          resolvedMap[nextItem.id] = serverId;
          if (nextItem.payload?.id) {
            resolvedMap[nextItem.payload.id] = serverId;
          }
        }

        updateQueueItem(nextItem.id, {
          status: 'SYNCED',
          lastAttemptAt: new Date().toISOString(),
          attemptCount: nextItem.attemptCount + 1,
          resolvedServerIds: resolvedMap,
          lastError: undefined
        });
      } else {
        const errorMsg = result.error || result.message || 'Server error';
        const conflict = result.conflict;

        if (conflict) {
          const localStatus = conflict.canRetry ? 'NEEDS_ACTION' : 'CONFLICT';
          updateQueueItem(nextItem.id, {
            status: localStatus,
            lastError: errorMsg,
            lastAttemptAt: new Date().toISOString(),
            attemptCount: nextItem.attemptCount + 1,
            conflictType: conflict.conflictType,
            serverMessage: conflict.message || errorMsg,
            recommendedAction: conflict.recommendedAction || null,
            canRetry: conflict.canRetry === true,
            canDiscard: conflict.canDiscard !== false,
            needsSupervisorReview: conflict.needsSupervisorReview !== false
          });

          // Report conflict to server
          await reportConflictToServer({
            ...nextItem,
            status: localStatus,
            conflictType: conflict.conflictType,
            serverMessage: conflict.message || errorMsg,
            recommendedAction: conflict.recommendedAction,
            canRetry: conflict.canRetry,
            canDiscard: conflict.canDiscard,
            needsSupervisorReview: conflict.needsSupervisorReview
          }, conflict, errorMsg);
        } else {
          updateQueueItem(nextItem.id, {
            status: 'FAILED',
            lastError: errorMsg,
            lastAttemptAt: new Date().toISOString(),
            attemptCount: nextItem.attemptCount + 1
          });
        }
      }
    } catch (err: any) {
      updateQueueItem(nextItem.id, {
        status: 'FAILED',
        lastError: err.message || 'Network request failed',
        lastAttemptAt: new Date().toISOString(),
        attemptCount: nextItem.attemptCount + 1
      });
    }
  }

  // Attempt to report any previously unreported conflicts
  const unreported = getQueue().filter(item => 
    (item.status === 'CONFLICT' || item.status === 'NEEDS_ACTION') && !item.conflictReported
  );
  for (const item of unreported) {
    await reportConflictToServer(item, {
      conflictType: item.conflictType,
      message: item.serverMessage || item.lastError,
      recommendedAction: item.recommendedAction,
      canRetry: item.canRetry,
      canDiscard: item.canDiscard,
      needsSupervisorReview: item.needsSupervisorReview
    }, item.lastError || '');
  }
}

async function reportConflictToServer(item: QueueItem, conflict: any, errorMsg: string): Promise<boolean> {
  try {
    const reportPayload = {
      operationType: item.operationType || 'SECURITY_GUARDING',
      employeeId: item.employeeId || '',
      assignmentId: item.assignmentId || null,
      checklistExecutionId: item.executionId || null,
      patrolExecutionId: item.patrolExecutionId || null,
      checkpointExecutionId: item.checkpointExecutionId || null,
      actionType: item.actionType,
      queueItemId: item.id,
      idempotencyKey: item.idempotencyKey,
      conflictType: conflict.conflictType,
      serverMessage: conflict.message || errorMsg,
      recommendedAction: conflict.recommendedAction || null,
      canRetry: conflict.canRetry === true,
      canDiscard: conflict.canDiscard !== false,
      needsSupervisorReview: conflict.needsSupervisorReview !== false
    };

    const res = await fetch('/api/v1/secfac/sync-conflicts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reportPayload)
    });

    if (res.ok) {
      updateQueueItem(item.id, { conflictReported: true });
      return true;
    }
  } catch (e) {
    console.error('Failed to report conflict to server, will retry later:', e);
  }
  return false;
}
