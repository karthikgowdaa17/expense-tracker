import type { CategoryInput } from '../validation/schemas.js';
export declare const categoriesRepository: {
    listByUser(userId: string): {
        id: any;
        user_id: any;
        name: any;
        type: any;
        icon: any;
        color: any;
        is_default: boolean;
        created_at: any;
    }[];
    getById(id: string): {
        id: any;
        user_id: any;
        name: any;
        type: any;
        icon: any;
        color: any;
        is_default: boolean;
        created_at: any;
    } | undefined;
    create(userId: string, data: CategoryInput): {
        id: any;
        user_id: any;
        name: any;
        type: any;
        icon: any;
        color: any;
        is_default: boolean;
        created_at: any;
    };
    ensureDefaults(userId: string): void;
    update(id: string, data: Partial<CategoryInput>): {
        id: any;
        user_id: any;
        name: any;
        type: any;
        icon: any;
        color: any;
        is_default: boolean;
        created_at: any;
    } | undefined;
    delete(id: string): boolean;
};
//# sourceMappingURL=categoriesRepository.d.ts.map