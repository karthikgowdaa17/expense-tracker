import type { AccountInput } from '../validation/schemas.js';
export declare const accountsRepository: {
    listByUser(userId: string): {
        id: any;
        user_id: any;
        name: any;
        type: any;
        bank_name: any;
        account_number_last4: any;
        opening_balance: any;
        currency: any;
        is_active: boolean;
        created_at: any;
        updated_at: any;
    }[];
    getById(id: string): {
        id: any;
        user_id: any;
        name: any;
        type: any;
        bank_name: any;
        account_number_last4: any;
        opening_balance: any;
        currency: any;
        is_active: boolean;
        created_at: any;
        updated_at: any;
    } | undefined;
    /** Same as getById but proves the account belongs to the user. */
    getByIdForUser(id: string, userId: string): {
        id: any;
        user_id: any;
        name: any;
        type: any;
        bank_name: any;
        account_number_last4: any;
        opening_balance: any;
        currency: any;
        is_active: boolean;
        created_at: any;
        updated_at: any;
    } | undefined;
    /** Find an account by exact name (case-insensitive) for a user. */
    findByName(userId: string, name: string): {
        id: any;
        user_id: any;
        name: any;
        type: any;
        bank_name: any;
        account_number_last4: any;
        opening_balance: any;
        currency: any;
        is_active: boolean;
        created_at: any;
        updated_at: any;
    } | undefined;
    /** Find a bank account by bank + last four digits of the account number. */
    findByBankAndLast4(userId: string, bankName: string | null, last4: string | null): {
        id: any;
        user_id: any;
        name: any;
        type: any;
        bank_name: any;
        account_number_last4: any;
        opening_balance: any;
        currency: any;
        is_active: boolean;
        created_at: any;
        updated_at: any;
    } | undefined;
    /** Provision the same default accounts the app has always used, once per user. */
    ensureDefaults(userId: string): void;
    create(userId: string, data: AccountInput): {
        id: any;
        user_id: any;
        name: any;
        type: any;
        bank_name: any;
        account_number_last4: any;
        opening_balance: any;
        currency: any;
        is_active: boolean;
        created_at: any;
        updated_at: any;
    };
    /** Returns the existing account or creates it. Never duplicates per user. */
    findOrCreate(userId: string, data: AccountInput): {
        id: any;
        user_id: any;
        name: any;
        type: any;
        bank_name: any;
        account_number_last4: any;
        opening_balance: any;
        currency: any;
        is_active: boolean;
        created_at: any;
        updated_at: any;
    };
    update(id: string, userId: string, data: Partial<AccountInput>): {
        id: any;
        user_id: any;
        name: any;
        type: any;
        bank_name: any;
        account_number_last4: any;
        opening_balance: any;
        currency: any;
        is_active: boolean;
        created_at: any;
        updated_at: any;
    } | undefined;
    delete(id: string, userId: string): boolean;
};
/**
 * Remove an account without silently losing its transactions.
 *  - unassign (default): transactions keep all data, account link is cleared
 *  - reassign: transactions move to another account of the same user
 *  - delete:  transactions of the account are deleted explicitly by the caller's choice
 */
export declare function deleteAccountSafely(userId: string, accountId: string, mode: 'unassign' | 'reassign' | 'delete', reassignTo?: string): {
    ok: boolean;
    affected: number;
    error?: string;
};
//# sourceMappingURL=accountsRepository.d.ts.map