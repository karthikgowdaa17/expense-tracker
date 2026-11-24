import { api } from './client';

export interface SyncStatus {
  lastSyncedAt: string | null;
  pendingChanges: number;
  isOnline: boolean;
  serverVersion: string;
  clientVersion: string;
  needsUpdate: boolean;
}

export interface SyncResult {
  success: boolean;
  syncedAt: string;
  changesApplied: number;
  conflicts: Array<{
    entity: string;
    id: string;
    serverData: unknown;
    localData: unknown;
  }>;
}

export const syncApi = {
  getStatus: () => api.get<SyncStatus>('/api/sync/status'),

  triggerSync: () => api.post<SyncResult>('/api/sync/trigger', {}),

  registerPendingChange: (entity: string, id: string, action: 'create' | 'update' | 'delete', data?: unknown) =>
    api.post('/api/sync/pending', { entity, id, action, data }),

  clearPendingChanges: () => api.delete('/api/sync/pending'),

  getVersion: () => api.get<{ version: string; buildDate: string }>('/api/version'),
};