import { show } from '@/routes/vaults';
import { move } from '@/routes/vaults/nodes';
import { useLayoutStore } from '@/stores/layout';
import { useVaultStore } from '@/stores/vault';
import { useVaultOpenedFileStore } from '@/stores/vaultOpenedFile';
import { useVaultRecentFileStore } from '@/stores/vaultRecentFile';
import { useVaultTreeStore } from '@/stores/vaultTree';
import { VaultNode } from '@/types/vault';
import { VaultShowPageProps } from '@/types/vault.pages';
import { router, usePage } from '@inertiajs/vue3';
import { useRequest } from './useRequest';
import { useToast } from './useToast';
import { useVaultTreeActions } from './useVaultTreeActions';
import { flushEdits } from './useAutosave';

let navigation = 0;

async function savePage(visit: number): Promise<boolean> {
    if (!await flushEdits() || visit !== navigation) return false;
    // Wait for autosaves' queued history updates before leaving this entry.
    await new Promise<void>(resolve => router.replace({
        preserveState: true,
        preserveScroll: true,
        onFinish: () => resolve(),
    }));
    return visit === navigation;
}

function resolvePaths(currentPath: string, path: string): string {
    // If path is absolute, return it
    if (path.startsWith('/')) {
        return path;
    }

    // Get the directory of currentPath (strip the filename)
    const currentDirectory = currentPath.endsWith('/')
        ? currentPath
        : currentPath.substring(0, currentPath.lastIndexOf('/') + 1);

    // Resolve the segments of the combined path
    const combined = currentDirectory + path;
    const segments = combined.split('/');
    const resolved: string[] = [];

    for (const segment of segments) {
        if (segment === '..') {
            if (resolved.length > 0) {
                resolved.pop();
            }
        } else if (segment !== '.') {
            resolved.push(segment);
        }
    }

    const resolvedPath = resolved.join('/') || '/';

    // If the resolved path starts with '/', it's still within the vault root
    if (resolvedPath.startsWith('/') || resolvedPath === '') {
        return resolvedPath || '/';
    }

    return resolvedPath;
}

export function useVaultActions() {
    const page = usePage<VaultShowPageProps>();
    const { createToast } = useToast();
    const layoutStore = useLayoutStore();
    const vaultStore = useVaultStore();
    const vaultRecentFileStore = useVaultRecentFileStore();
    const vaultOpenedFileStore = useVaultOpenedFileStore();
    const vaultTreeStore = useVaultTreeStore();
    const vaultTreeActions = useVaultTreeActions();
    const moveRequest = useRequest<{ parent_id: number | null }>({ parent_id: null });

    async function openFile(fileId: number): Promise<void> {
        if (!vaultStore.id) {
            return;
        }

        const visit = ++navigation;
        if (!await savePage(visit)) return;
        if (page.props.openedFile?.file.id === fileId && !layoutStore.isFileLoading) return;
        layoutStore.isFileLoading = true;

        router.visit(show.url({ vault: vaultStore.id }), {
            method: 'get',
            data: {
                file: fileId,
            },
            preserveState: true,
            preserveScroll: true,
            showProgress: false,
            only: ['openedFile'],
            onSuccess: () => {
                vaultTreeStore.handleFileOpened(
                    fileId,
                    page.props.openedFile?.ancestors ?? [],
                    page.props.openedFile?.ancestorsChildren ?? {}
                );
            },
            onFinish: () => {
                if (visit === navigation) layoutStore.isFileLoading = false;
            },
        });
    }

    function openFilePath(path: string): void {
        if (!vaultStore.id || !vaultTreeStore.getSelectedFileId()) {
            return;
        }

        const recentFile = vaultRecentFileStore.recentFiles.find(
            f => f.id === vaultTreeStore.getSelectedFileId()
        );

        if (!recentFile) {
            return;
        }

        const resolvedPath = resolvePaths(
            decodeURIComponent(recentFile.full_path),
            decodeURIComponent(path)
        );
        const file = vaultOpenedFileStore.links.find(l => l.full_path === resolvedPath);

        if (!file) {
            return;
        }

        openFile(file.id);
    }

    async function closeFile(): Promise<void> {
        if (!vaultStore.id) {
            return;
        }

        const visit = ++navigation;
        if (!await savePage(visit)) return;
        router.cancelAll({ async: false, prefetch: false });
        layoutStore.isFileLoading = false;

        router.push<VaultShowPageProps>({
            url: show.url({ vault: vaultStore.id }),
            props: current => ({ ...current, openedFile: null }),
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                vaultTreeStore.setSelectedFileId(null);
            },
        });
    }

    function moveNode(nodeId: number, newParentId: number | null, onSuccess?: () => void): void {
        if (layoutStore.isTreeViewLoading) return;
        const node = vaultTreeStore.getNodeById(nodeId);

        if (!node) {
            createToast('Something went wrong', 'error');

            return;
        }

        if (node.parent_id === newParentId) {
            onSuccess?.();
            return;
        }

        layoutStore.setTreeViewLoading(true);

        const url = move.url({
            vault: page.props.vault.id,
            node: nodeId,
        });

        moveRequest.parent_id = newParentId;

        moveRequest.patch<{ data: VaultNode }>(url, {
            onSuccess: response => {
                const message = node.is_file ? 'File moved' : 'Folder moved';
                createToast(message, 'success');

                vaultTreeActions.handleNodeUpdated(response.data);
                vaultTreeActions.fetchChildren(newParentId, children => {
                    vaultTreeStore.setChildren(newParentId, children);
                    if (newParentId !== null) {
                        vaultTreeStore.setLoadedFolder(newParentId);
                        vaultTreeStore.expandFolder(newParentId);
                        vaultTreeStore.expandParents(newParentId);
                    }
                });

                if (response.data.is_file) {
                    vaultRecentFileStore.upsertRecentFile(response.data);
                }

                if (page.props.openedFile?.file.id === response.data.id) {
                    page.props.openedFile.file.parent_id = response.data.parent_id;
                    page.props.openedFile.file.name = response.data.name;
                }
                onSuccess?.();
            },
            onInvalid: errors => createToast(Object.values(errors)[0] || 'This move is not possible.', 'error'),
            onFinish: () => layoutStore.setTreeViewLoading(false),
        });
    }

    function handleNodesDeleted(nodeIds: number[], showToast = true): void {
        const selectedFileId = page.props.openedFile?.file.id;
        vaultTreeActions.handleNodesDeleted(nodeIds);

        if (selectedFileId === undefined || !nodeIds.includes(selectedFileId)) {
            router.reload({ only: ['recentFiles'] });

            return;
        }

        router.visit(show.url({ vault: page.props.vault.id }), {
            replace: true,
            preserveState: true,
            preserveScroll: true,
            showProgress: false,
            only: ['openedFile', 'recentFiles'],
            onSuccess: () => {
                if (showToast) {
                    createToast('File deleted', 'warning');
                }
            },
        });
    }

    return {
        openFile,
        openFilePath,
        closeFile,
        moveNode,
        handleNodesDeleted,
    };
}
