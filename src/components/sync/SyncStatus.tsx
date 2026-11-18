'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/utils/currency';
import { formatDistanceToNow } from 'date-fns';
import { syncApi, SyncStatus } from '@/lib/api/sync';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

export function SyncStatusIndicator() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      const data = await syncApi.getStatus();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sync status');
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      await syncApi.triggerSync();
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (loading) {
    return (
      <Button variant="ghost" size="icon" disabled className="relative">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="sr-only">Loading sync status...</span>
      </Button>
    );
  }

  if (!status) {
    return (
      <Button variant="ghost" size="icon" onClick={fetchStatus} className="text-destructive">
        <AlertCircle className="h-5 w-5" />
        <span className="sr-only">Sync error - click to retry</span>
      </Button>
    );
  }

  const isStale = status.lastSyncedAt 
    ? Date.now() - new Date(status.lastSyncedAt).getTime() > 300000 
    : true;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={triggerSync}
          disabled={syncing}
          className={cn(
            'relative',
            status.isOnline ? 'text-green-500' : 'text-red-500',
            isStale && 'text-yellow-500'
          )}
          title={status.isOnline ? 'Online' : 'Offline'}
        >
          {syncing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : status.isOnline ? (
            <Wifi className="h-5 w-5" />
          ) : (
            <WifiOff className="h-5 w-5" />
          )}
          {status.pendingChanges > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
              {status.pendingChanges > 9 ? '9+' : status.pendingChanges}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Sync Status</span>
          <Button variant="ghost" size="icon" onClick={fetchStatus} className="h-6 w-6 p-0">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <div className="px-2 py-1 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <span className={cn('font-medium flex items-center gap-1', status.isOnline ? 'text-green-600' : 'text-red-600')}>
              {status.isOnline ? (
                <>
                  <CheckCircle className="h-3 w-3" />
                  Online
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  Offline
                </>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Last Sync</span>
            <span className="font-medium flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {status.lastSyncedAt 
                ? formatDistanceToNow(new Date(status.lastSyncedAt), { addSuffix: true })
                : 'Never'}
            </span>
          </div>

          {status.pendingChanges > 0 && (
            <div className="flex items-center justify-between text-sm text-yellow-600">
              <span className="text-muted-foreground">Pending Changes</span>
              <span className="font-medium flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {status.pendingChanges}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">App Version</span>
            <span className="font-medium font-mono text-xs">{status.clientVersion}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Server Version</span>
            <span className="font-medium font-mono text-xs">{status.serverVersion}</span>
          </div>
        </div>

        {status.needsUpdate && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive flex items-center gap-2" onClick={() => window.location.reload()}>
              <AlertCircle className="h-4 w-4" />
              Update Available - Click to Reload
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={triggerSync} 
          disabled={syncing}
          className="flex items-center gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </DropdownMenuItem>

        {error && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive text-sm px-2 py-1">
              Error: {error}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}