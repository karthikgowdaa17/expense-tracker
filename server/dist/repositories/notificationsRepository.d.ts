export declare const notificationsRepository: {
    listByUser(userId: string, unreadOnly?: boolean): {
        id: any;
        user_id: any;
        type: any;
        title: any;
        message: any;
        is_read: boolean;
        related_entity_type: any;
        related_entity_id: any;
        created_at: any;
        updated_at: any;
    }[];
    getById(id: string): {
        id: any;
        user_id: any;
        type: any;
        title: any;
        message: any;
        is_read: boolean;
        related_entity_type: any;
        related_entity_id: any;
        created_at: any;
        updated_at: any;
    } | undefined;
    create(userId: string, data: {
        type: "over_budget" | "recurring_generated" | "system";
        title: string;
        message: string;
        related_entity_type?: string | null;
        related_entity_id?: string | null;
    }): {
        id: any;
        user_id: any;
        type: any;
        title: any;
        message: any;
        is_read: boolean;
        related_entity_type: any;
        related_entity_id: any;
        created_at: any;
        updated_at: any;
    };
    markRead(id: string): boolean;
    markAllRead(userId: string): number;
    delete(id: string): boolean;
};
//# sourceMappingURL=notificationsRepository.d.ts.map