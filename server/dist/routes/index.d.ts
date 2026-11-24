import { type User } from '../repositories/usersRepository.js';
import type { IncomingMessage, ServerResponse } from 'http';
export declare class ValidationError extends Error {
    constructor(message: string);
}
export declare function getUserId(req: IncomingMessage): string | null;
export declare function requireAuth(req: IncomingMessage): User;
export declare function handleProfiles(req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare function handleCategories(req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare function handleAccounts(req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare function handleTransactions(req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare function handleBudgets(req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare function handleRecurring(req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare function handlePayments(req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare function handleUserSettings(req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare function handleSync(req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare function handleNotifications(req: IncomingMessage, res: ServerResponse): Promise<void>;
//# sourceMappingURL=index.d.ts.map