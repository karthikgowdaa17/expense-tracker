import type { AccountInput } from '../validation/schemas.js';
export declare const accountsRepository: {
    listByUser(userId: string): {
        id: any;
        user_id: any;
        name: any;
        type: any;
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
        opening_balance: any;
        currency: any;
        is_active: boolean;
        created_at: any;
        updated_at: any;
    } | undefined;
    create(userId: string, data: AccountInput): {
        id: any;
        user_id: any;
        name: any;
        type: any;
        opening_balance: any;
        currency: any;
        is_active: boolean;
        created_at: any;
        updated_at: any;
    };
    update(id: string, data: Partial<AccountInput>): {
        id: any;
        user_id: any;
        name: any;
        type: any;
        opening_balance: any;
        currency: any;
        is_active: boolean;
        created_at: any;
        updated_at: any;
    } | undefined;
    delete(id: string): boolean;
};
//# sourceMappingURL=accountsRepository.d.ts.map