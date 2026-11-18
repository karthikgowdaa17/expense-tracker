import type { ProfileInput } from '../validation/schemas.js';
export declare const profilesRepository: {
    getById(id: string): any | undefined;
    upsert(id: string, data: ProfileInput): any;
};
//# sourceMappingURL=profilesRepository.d.ts.map