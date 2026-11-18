import type { UserSettingsInput } from '../validation/schemas.js';
export declare const userSettingsRepository: {
    getByUser(userId: string): {
        id: any;
        user_id: any;
        currency: any;
        theme: any;
        financial_year_start_month: any;
        default_categories: any;
        default_payment_methods: any;
        default_accounts: any;
        created_at: any;
        updated_at: any;
    } | undefined;
    getOrCreate(userId: string): {
        id: any;
        user_id: any;
        currency: any;
        theme: any;
        financial_year_start_month: any;
        default_categories: any;
        default_payment_methods: any;
        default_accounts: any;
        created_at: any;
        updated_at: any;
    };
    upsert(userId: string, data: UserSettingsInput): {
        id: any;
        user_id: any;
        currency: any;
        theme: any;
        financial_year_start_month: any;
        default_categories: any;
        default_payment_methods: any;
        default_accounts: any;
        created_at: any;
        updated_at: any;
    };
};
//# sourceMappingURL=userSettingsRepository.d.ts.map