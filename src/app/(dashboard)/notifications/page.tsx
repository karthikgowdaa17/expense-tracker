'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/utils/currency';
import { AlertTriangle, Bell, Clock, Repeat } from 'lucide-react';
import { notificationsApi, type Notification } from '@/lib/api/notifications';
import { toast } from 'sonner';

const TYPE_CONFIG: Record<
  Notification['type'],
  { label: string; variant: React.ComponentProps<typeof Badge>['variant']; icon: React.ComponentType<{ className?: string }> }
> = {
  over_budget: { label: 'Over Budget', variant: 'destructive', icon: AlertTriangle },
  recurring_generated: { label: 'Recurring generated', variant: 'default', icon: Repeat },
  system: { label: 'System', variant: 'secondary', icon: Bell },
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        setLoading(true);
        if (!user) return;
        const list = await notificationsApi.getList(false);
        if (!ignore) setNotifications(list);
      } catch {
        toast.error('Failed to load notifications');
        if (!ignore) setNotifications([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [user]);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const sorted = [...notifications].sort(
    (a, b) =>
      Number(a.is_read) - Number(b.is_read) ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const handleMarkRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications(cur =>
        cur.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
      toast.success('Marked as read');
    } catch {
      toast.error('Failed to mark as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications(cur => cur.map(n => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const formatTime = (createdAt: string) =>
    new Date(createdAt).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="sr-only">Loading notifications</span>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">All your alerts in one place.</p>
        </div>
        <Alert variant="destructive" className="pl-7">
          <AlertTriangle className="mr-2 h-4 w-4" />
          <AlertTitle>No notifications</AlertTitle>
          <AlertDescription>
            All caught up &mdash; there are no new alerts right now.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            {unreadCount} unread
          </p>
        </div>
        <Button onClick={handleMarkAllRead} disabled={unreadCount === 0}>
          <Bell className="mr-2 h-4 w-4" /> Mark all as read
        </Button>
      </div>

      <div className="space-y-3">
        {sorted.map(notification => {
          const config = TYPE_CONFIG[notification.type];
          return (
            <Card
              key={notification.id}
              className={cn(
                'border-l-2',
                !notification.is_read ? 'border-primary' : 'border-muted',
                !notification.is_read ? 'bg-primary/5' : ''
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-medium">{notification.title}</CardTitle>
                  <Badge variant={config.variant}>{config.label}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatTime(notification.created_at)}
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{notification.message}</p>
              </CardContent>
              {!notification.is_read && (
                <CardFooter>
                  <Button size="sm" onClick={() => handleMarkRead(notification.id)}>
                    <Clock className="mr-2 h-4 w-4" /> Mark as read
                  </Button>
                </CardFooter>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
