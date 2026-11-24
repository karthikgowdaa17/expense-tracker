import { api } from './client';

export type NotificationType = 'over_budget' | 'recurring_generated' | 'system';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarkAllReadResult {
  success: boolean;
  count: number;
}

export const notificationsApi = {
  getList: (unreadOnly = false) =>
    api.get<Notification[]>(
      unreadOnly ? '/api/notifications?unread=true' : '/api/notifications'
    ),

  markRead: (id: string) =>
    api.patch<{ success: boolean }>(`/api/notifications/${id}/read`, {}),

  markAllRead: () => api.post<MarkAllReadResult>('/api/notifications/mark-all-read', {}),
};
