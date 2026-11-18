import type { SignupInput } from '../validation/schemas.js';
export interface User {
    id: string;
    email: string;
    password_hash: string;
    email_verified: number;
    created_at: string;
    updated_at: string;
}
export interface RefreshToken {
    id: string;
    user_id: string;
    token_hash: string;
    expires_at: string;
    created_at: string;
}
export interface PasswordResetToken {
    id: string;
    user_id: string;
    token_hash: string;
    expires_at: string;
    used: number;
    created_at: string;
}
export interface EmailVerificationToken {
    id: string;
    user_id: string;
    token_hash: string;
    expires_at: string;
    used: number;
    created_at: string;
}
export declare const usersRepository: {
    getByEmail(email: string): User | undefined;
    getById(id: string): User | undefined;
    create(data: SignupInput & {
        password_hash: string;
    }): User;
    updatePassword(userId: string, passwordHash: string): void;
    setEmailVerified(userId: string): void;
};
export declare const refreshTokensRepository: {
    create(userId: string, tokenHash: string, expiresAt: string): RefreshToken;
    getById(id: string): RefreshToken | undefined;
    getByTokenHash(tokenHash: string): RefreshToken | undefined;
    delete(id: string): boolean;
    deleteByUserId(userId: string): void;
    deleteExpired(): void;
};
export declare const passwordResetTokensRepository: {
    create(userId: string, rawToken: string, expiresAt: string): PasswordResetToken;
    getById(id: string): PasswordResetToken | undefined;
    getByTokenHash(tokenHash: string): PasswordResetToken | undefined;
    markUsed(id: string): void;
    deleteExpired(): void;
};
export declare const emailVerificationTokensRepository: {
    create(userId: string, rawToken: string, expiresAt: string): EmailVerificationToken;
    getById(id: string): EmailVerificationToken | undefined;
    getByTokenHash(tokenHash: string): EmailVerificationToken | undefined;
    markUsed(id: string): void;
    deleteExpired(): void;
};
//# sourceMappingURL=usersRepository.d.ts.map