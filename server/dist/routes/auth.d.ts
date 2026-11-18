import { type User } from '../repositories/usersRepository.js';
import type { IncomingMessage, ServerResponse } from 'http';
declare function hashToken(token: string): string;
declare function generateAccessToken(user: User): string;
declare function verifyAccessToken(token: string): {
    sub: string;
    email: string;
} | null;
export declare function handleAuthLogin(req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare function handleAuthSignup(req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare function handleAuthRefresh(req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare function handleAuthMe(req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare function authenticateRequest(req: IncomingMessage): User | null;
export declare function handleAuthForgotPassword(req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare function handleAuthResetPassword(req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare function handleAuthVerifyEmail(req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare function handleAuthResendVerification(req: IncomingMessage, res: ServerResponse): Promise<void>;
export { generateAccessToken, hashToken, verifyAccessToken };
//# sourceMappingURL=auth.d.ts.map