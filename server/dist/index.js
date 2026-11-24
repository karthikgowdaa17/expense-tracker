import 'dotenv/config';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { eventBus } from './events/eventBus.js';
import { db, closeDatabase } from './persistence/db.js';
import { runMigrations } from './persistence/migrationRunner.js';
let isShuttingDown = false;
async function shutdown(signal) {
    if (isShuttingDown) {
        console.log(`[Shutdown] Already in progress, ignoring ${signal}`);
        return;
    }
    isShuttingDown = true;
    console.log(`[Shutdown] Received ${signal}, starting graceful shutdown...`);
    try {
        // 1. Stop accepting new HTTP connections
        console.log('[Shutdown] Closing HTTP server...');
        await new Promise((resolve) => {
            server.close((err) => {
                if (err)
                    console.error('[Shutdown] HTTP server close error:', err);
                resolve();
            });
        });
        // 2. Close WebSocket server cleanly
        console.log('[Shutdown] Closing WebSocket server...');
        await new Promise((resolve) => {
            wss.close((err) => {
                if (err)
                    console.error('[Shutdown] WebSocket server close error:', err);
                resolve();
            });
        });
        // 3. Close all active WebSocket connections
        console.log('[Shutdown] Closing WebSocket clients...');
        for (const client of clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.close(1001, 'Server shutting down');
            }
        }
        clients.clear();
        // 4. Close SQLite database connection
        console.log('[Shutdown] Closing database...');
        closeDatabase();
        console.log('[Shutdown] Graceful shutdown complete');
    }
    catch (error) {
        console.error('[Shutdown] Error during shutdown:', error);
    }
    finally {
        process.exit(0);
    }
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    shutdown('uncaughtException').catch(() => process.exit(1));
});
import { handleProfiles, handleCategories, handleAccounts, handleTransactions, handleBudgets, handleRecurring, handleUserSettings, handleNotifications, handlePayments, handleSync, ValidationError, } from './routes/index.js';
import { handleAuthLogin, handleAuthSignup, handleAuthRefresh, handleAuthMe, handleAuthForgotPassword, handleAuthResetPassword, handleAuthVerifyEmail, handleAuthResendVerification, } from './routes/auth.js';
const clients = new Set();
const ALLOWED_ORIGIN = 'http://localhost:3000';
function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
}
function handleOptions(req, res) {
    if (req.method === 'OPTIONS') {
        setCorsHeaders(res);
        res.writeHead(204);
        res.end();
        return true;
    }
    return false;
}
runMigrations();
void db;
const server = createServer(handleRequest);
const wss = new WebSocketServer({ server });
async function handleRequest(req, res) {
    // Handle CORS preflight
    if (handleOptions(req, res))
        return;
    // Health and status
    if (req.url === '/health' && req.method === 'GET') {
        setCorsHeaders(res);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
    }
    if (req.url === '/api/status' && req.method === 'GET') {
        setCorsHeaders(res);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: 'kd-workscape-server' }));
        return;
    }
    // API routes
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathname = url.pathname;
        // Auth routes (no authentication required)
        if (pathname === '/api/auth/login' && req.method === 'POST') {
            setCorsHeaders(res);
            await handleAuthLogin(req, res);
            return;
        }
        if (pathname === '/api/auth/signup' && req.method === 'POST') {
            setCorsHeaders(res);
            await handleAuthSignup(req, res);
            return;
        }
        if (pathname === '/api/auth/refresh' && req.method === 'POST') {
            setCorsHeaders(res);
            await handleAuthRefresh(req, res);
            return;
        }
        if (pathname === '/api/auth/me' && req.method === 'GET') {
            setCorsHeaders(res);
            await handleAuthMe(req, res);
            return;
        }
        if (pathname === '/api/auth/forgot-password' && req.method === 'POST') {
            setCorsHeaders(res);
            await handleAuthForgotPassword(req, res);
            return;
        }
        if (pathname === '/api/auth/reset-password' && req.method === 'POST') {
            setCorsHeaders(res);
            await handleAuthResetPassword(req, res);
            return;
        }
        if (pathname === '/api/auth/verify-email' && req.method === 'POST') {
            setCorsHeaders(res);
            await handleAuthVerifyEmail(req, res);
            return;
        }
        if (pathname === '/api/auth/resend-verification' && req.method === 'POST') {
            setCorsHeaders(res);
            await handleAuthResendVerification(req, res);
            return;
        }
        // Protected routes (require authentication)
        if (pathname === '/api/profiles' || pathname.startsWith('/api/profiles/')) {
            setCorsHeaders(res);
            await handleProfiles(req, res);
            return;
        }
        if (pathname === '/api/categories' || pathname.startsWith('/api/categories/')) {
            setCorsHeaders(res);
            await handleCategories(req, res);
            return;
        }
        if (pathname === '/api/accounts' || pathname.startsWith('/api/accounts/')) {
            setCorsHeaders(res);
            await handleAccounts(req, res);
            return;
        }
        if (pathname === '/api/transactions' || pathname.startsWith('/api/transactions/')) {
            setCorsHeaders(res);
            await handleTransactions(req, res);
            return;
        }
        if (pathname === '/api/budgets' || pathname.startsWith('/api/budgets/')) {
            setCorsHeaders(res);
            await handleBudgets(req, res);
            return;
        }
        if (pathname === '/api/recurring' || pathname.startsWith('/api/recurring/')) {
            setCorsHeaders(res);
            await handleRecurring(req, res);
            return;
        }
        if (pathname === '/api/payments' || pathname.startsWith('/api/payments/')) {
            setCorsHeaders(res);
            await handlePayments(req, res);
            return;
        }
        if (pathname === '/api/sync' || pathname.startsWith('/api/sync/')) {
            setCorsHeaders(res);
            await handleSync(req, res);
            return;
        }
        if (pathname === '/api/version') {
            setCorsHeaders(res);
            await handleSync(req, res);
            return;
        }
        if (pathname === '/api/settings') {
            setCorsHeaders(res);
            await handleUserSettings(req, res);
            return;
        }
        if (pathname === '/api/notifications' || pathname.startsWith('/api/notifications/')) {
            setCorsHeaders(res);
            await handleNotifications(req, res);
            return;
        }
    }
    catch (err) {
        console.error('Request error:', err);
        setCorsHeaders(res);
        if (err instanceof ValidationError) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
            return;
        }
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
        return;
    }
    setCorsHeaders(res);
    res.writeHead(404);
    res.end('Not Found');
}
wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('[WS] Client connected');
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            ws.send(JSON.stringify({ type: 'ack', payload: { received: message.type } }));
            eventBus.publish({ source: 'ws', message });
        }
        catch (error) {
            console.error('[WS] Error handling message:', error);
            ws.send(JSON.stringify({ type: 'error', payload: { message: String(error) } }));
        }
    });
    ws.on('close', () => {
        clients.delete(ws);
        console.log('[WS] Client disconnected');
    });
    ws.on('error', (error) => {
        console.error('[WS] Error:', error);
    });
});
// Broadcast domain events to all WS clients
eventBus.subscribe((event) => {
    const msg = JSON.stringify({ type: 'event', payload: event });
    for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    }
});
const PORT = Number(process.env.PORT) || 8080;
// --- Auto-recurring cron: generate due recurring transactions every hour ---
import { recurringTransactionsRepository } from './repositories/recurringTransactionsRepository.js';
import { transactionsRepository } from './repositories/transactionsRepository.js';
import { notificationsRepository } from './repositories/notificationsRepository.js';
function generateDueRecurring() {
    try {
        const rows = db.prepare('SELECT DISTINCT user_id FROM recurring_transactions WHERE is_active = 1').all();
        for (const { user_id } of rows) {
            const list = recurringTransactionsRepository.listByUser(user_id);
            const now = new Date();
            const nowStr = now.toISOString().split('T')[0];
            let generated = 0;
            for (const rec of list) {
                const endDate = rec.end_date;
                if (endDate && endDate < nowStr)
                    continue;
                let due = false;
                const lastGen = rec.last_generated ? new Date(rec.last_generated) : null;
                const start = new Date(rec.start_date);
                if (!lastGen) {
                    due = now >= start;
                }
                else {
                    const lastGenStr = lastGen.toISOString().split('T')[0];
                    switch (rec.frequency) {
                        case 'daily':
                            due = nowStr > lastGenStr;
                            break;
                        case 'weekly':
                            due = now.getTime() - lastGen.getTime() >= 7 * 24 * 60 * 60 * 1000;
                            break;
                        case 'monthly':
                            due = now.getFullYear() > lastGen.getFullYear() || (now.getFullYear() === lastGen.getFullYear() && now.getMonth() > lastGen.getMonth());
                            break;
                        case 'quarterly':
                            due = now.getFullYear() > lastGen.getFullYear() || (now.getFullYear() === lastGen.getFullYear() && now.getMonth() - lastGen.getMonth() >= 3);
                            break;
                        case 'yearly':
                            due = now.getFullYear() > lastGen.getFullYear();
                            break;
                        default: due = false;
                    }
                }
                if (!due)
                    continue;
                const genDate = new Date(now);
                if (rec.frequency === 'monthly' || rec.frequency === 'quarterly' || rec.frequency === 'yearly') {
                    const day = rec.day_of_month ?? now.getDate();
                    genDate.setDate(Math.min(day, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()));
                }
                const genDateStr = genDate.toISOString().split('T')[0];
                transactionsRepository.create(user_id, {
                    date: genDateStr,
                    type: 'expense',
                    amount: rec.amount,
                    category: rec.category,
                    subcategory: rec.subcategory ?? undefined,
                    description: rec.description ?? rec.name,
                    payment_method: rec.payment_method,
                    account: rec.account,
                    account_id: undefined,
                    transfer_direction: null,
                    notes: `Recurring: ${rec.name}`,
                    is_recurring: true,
                    recurring_id: rec.id,
                });
                recurringTransactionsRepository.update(rec.id, { last_generated: nowStr });
                generated++;
                eventBus.publish({ type: 'transaction.created', payload: { user_id, recurring_id: rec.id } });
            }
            if (generated > 0) {
                notificationsRepository.create(user_id, {
                    type: 'recurring_generated',
                    title: 'Recurring transactions generated',
                    message: `${generated} recurring transaction(s) created for ${nowStr}.`,
                });
            }
        }
    }
    catch (err) {
        console.error('[Recurring Cron] Error generating recurring transactions:', err);
    }
}
// Run immediately on startup, then every hour
generateDueRecurring();
setInterval(generateDueRecurring, 60 * 60 * 1000);
server.listen(PORT, () => {
    console.log(`[Server] HTTP + WS server running on http://localhost:${PORT}`);
    console.log(`[Server] WebSocket available at ws://localhost:${PORT}`);
    console.log(`[Server] Health endpoint at http://localhost:${PORT}/health`);
    console.log(`[Server] Status endpoint at http://localhost:${PORT}/api/status`);
});
//# sourceMappingURL=index.js.map