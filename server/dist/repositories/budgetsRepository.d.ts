import type { BudgetInput } from '../validation/schemas.js';
export declare const budgetsRepository: {
    listByUser(userId: string, month?: string): {
        id: any;
        user_id: any;
        category_id: any;
        month: any;
        amount: any;
        notes: any;
        created_at: any;
        updated_at: any;
    }[];
    getById(id: string): {
        id: any;
        user_id: any;
        category_id: any;
        month: any;
        amount: any;
        notes: any;
        created_at: any;
        updated_at: any;
    } | undefined;
    create(userId: string, data: BudgetInput): {
        id: any;
        user_id: any;
        category_id: any;
        month: any;
        amount: any;
        notes: any;
        created_at: any;
        updated_at: any;
    };
    update(id: string, data: Partial<BudgetInput>): {
        id: any;
        user_id: any;
        category_id: any;
        month: any;
        amount: any;
        notes: any;
        created_at: any;
        updated_at: any;
    } | undefined;
    delete(id: string): boolean;
};
//# sourceMappingURL=budgetsRepository.d.ts.map