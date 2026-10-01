import type { VaultNode } from './vault';

export type ShareNode = Pick<VaultNode, 'id' | 'parent_id' | 'name' | 'type' | 'is_file'>;
export type ShareFile = Pick<VaultNode, 'id' | 'name' | 'type' | 'content' | 'url'>;
export type ShareData = {
    base?: string;
    vaultId?: number;
    name?: string;
    nodes?: ShareNode[];
    selected?: ShareFile | null;
    error?: string;
};
