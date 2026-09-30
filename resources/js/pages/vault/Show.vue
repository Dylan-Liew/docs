<script setup lang="ts">
import MarkdownToolbar from '@/components/editor/MarkdownToolbar.vue';
import UserMenu from '@/components/menu/UserMenu.vue';
import VaultNodeCreateModal from '@/components/modal/VaultNodeCreateModal.vue';
import VaultSearchModal from '@/components/modal/VaultSearchModal.vue';
import VaultTree from '@/components/tree/VaultTree.vue';
import VaultFile from '@/components/vault/VaultFile.vue';
import VaultFileAudio from '@/components/vault/VaultFileAudio.vue';
import VaultFileIcon from '@/components/vault/VaultFileIcon.vue';
import VaultFileImage from '@/components/vault/VaultFileImage.vue';
import VaultFileNote from '@/components/vault/VaultFileNote.vue';
import VaultFilePdf from '@/components/vault/VaultFilePdf.vue';
import VaultFileVideo from '@/components/vault/VaultFileVideo.vue';
import VaultToggleContentWidthButton from '@/components/vault/VaultToggleContentWidthButton.vue';
import { useContentWidthPreference } from '@/composables/useContentWidthPreference';
import { useEditor } from '@/composables/useEditor';
import { useModalManager } from '@/composables/useModalManager';
import { useScreenSize } from '@/composables/useScreenSize';
import { useToast } from '@/composables/useToast';
import { useVaultActions } from '@/composables/useVaultActions';
import { useVaultTreeActions } from '@/composables/useVaultTreeActions';
import Bars3BottomLeft from '@/icons/Bars3BottomLeft.vue';
import Doc from '@/icons/Doc.vue';
import MagnifyingGlass from '@/icons/MagnifyingGlass.vue';
import Plus from '@/icons/Plus.vue';
import AuthLayout from '@/layouts/AuthLayout.vue';
import { index } from '@/routes/vaults';
import { useLayoutStore } from '@/stores/layout';
import { useVaultStore } from '@/stores/vault';
import { useVaultOpenedFileStore } from '@/stores/vaultOpenedFile';
import { useVaultRecentFileStore } from '@/stores/vaultRecentFile';
import { useVaultTemplateStore } from '@/stores/vaultTemplate';
import { useVaultTreeStore } from '@/stores/vaultTree';
import {
    VaultCollaborator,
    VaultEditorTemplateFile,
    VaultNode,
    VaultOpenedFileData,
} from '@/types/vault';
import { VaultUpdated } from '@/types/vault.events';
import { VaultShowPageProps } from '@/types/vault.pages';
import { formatElapsedTime, formatExtendedDate } from '@/utils/time';
import { Head, Link, router, usePage } from '@inertiajs/vue3';
import { useEcho } from '@laravel/echo-vue';
import { storeToRefs } from 'pinia';
import { onMounted, provide, ref, shallowRef, watch } from 'vue';

defineOptions({ layout: AuthLayout });

const props = defineProps<VaultShowPageProps>();
const page = usePage();
const channel = `Vault.${props.vault.id}.${page.props.app?.user?.id}`;

const layoutStore = useLayoutStore();
const { isLeftPanelOpen } = storeToRefs(layoutStore);
const { toggleLeftPanel, closePanels, syncPanelsWithScreen } = layoutStore;
const vaultStore = useVaultStore();
const vaultRecentFileStore = useVaultRecentFileStore();
const vaultOpenedFileStore = useVaultOpenedFileStore();
const vaultTreeStore = useVaultTreeStore();
const vaultTemplateStore = useVaultTemplateStore();
const { openModal } = useModalManager();
const { createToast } = useToast();
useEcho<{ data: { vault_id: number } }>(`User.${page.props.app?.user?.id}`, 'VaultCollaborationAccessRevokedEvent', ({ data }) => {
    if (data.vault_id === props.vault.id) {
        createToast('Your access to this vault has changed.', 'error');
        router.visit('/vaults');
    }
});
const { isSmallScreen } = useScreenSize();
const vaultActions = useVaultActions();
const vaultTreeActions = useVaultTreeActions();

const mainSectionRef = ref<HTMLElement | null>(null);
useContentWidthPreference(mainSectionRef);
syncPanelsWithScreen(isSmallScreen.value);

const openedFile = ref(props.openedFile ?? null);
const fileComponents = {
    note: VaultFileNote,
    image: VaultFileImage,
    pdf: VaultFilePdf,
    video: VaultFileVideo,
    audio: VaultFileAudio,
};

const editorContext = shallowRef<ReturnType<typeof useEditor> | null>(null);
provide('editorContext', editorContext);

onMounted(() => {
    // History restores the page component, but the current vault's tree stays in memory.
    if (vaultStore.id !== props.vault.id) {
        vaultTreeStore.initializeVaultTree(
            openedFile.value?.file.id ?? null,
            props.rootNodes,
            openedFile.value?.ancestors,
            openedFile.value?.ancestorsChildren
        );
    }
    vaultStore.setVault(props.vault);
    vaultRecentFileStore.setRecentFiles(props.recentFiles);
});

watch(
    () => props.openedFile,
    (openedFileProp, previous) => {
        openedFile.value = openedFileProp ?? null;
        vaultOpenedFileStore.set(
            openedFile.value?.links,
            openedFile.value?.backlinks,
            openedFile.value?.tags
        );

        if (openedFile.value) {
            // Local save/history updates must not replay an older tree snapshot.
            if (openedFileProp?.file.id !== previous?.file.id ||
                openedFileProp?.ancestors !== previous?.ancestors ||
                openedFileProp?.ancestorsChildren !== previous?.ancestorsChildren) {
                vaultTreeStore.handleFileOpened(
                    openedFile.value.file.id,
                    openedFile.value.ancestors ?? [],
                    openedFile.value.ancestorsChildren ?? {}
                );
            }
        } else {
            vaultTreeStore.setSelectedFileId(null);
            editorContext.value = null;
        }
    },
    { immediate: true }
);

watch(
    () => props.recentFiles,
    files => vaultRecentFileStore.setRecentFiles(files),
    { immediate: true }
);

watch(
    () => props.templateNodes,
    templates => vaultTemplateStore.setTemplates(templates ?? null),
    { immediate: true }
);

watch(isSmallScreen, value => {
    syncPanelsWithScreen(value);
});

useEcho<{ data: VaultUpdated }>(channel, 'VaultUpdatedEvent', payload => {
    vaultTreeActions.handleVaultUpdated(payload.data);
});

useEcho(channel, 'VaultDeletedEvent', () => {
    router.visit(index.url(), {
        replace: true,
        fresh: true,
        onSuccess: () => {
            createToast('Vault deleted', 'warning');
        },
    });
});

useEcho<{ data: VaultEditorTemplateFile[] | null }>(
    channel,
    'VaultTemplateListUpdatedEvent',
    payload => {
        vaultTemplateStore.setTemplates(payload.data);
    }
);

useEcho<{ data: VaultNode }>(channel, 'VaultNodeCreatedEvent', payload => {
    vaultTreeStore.handleNodeSaved(payload.data);

    if (payload.data.is_file) {
        vaultRecentFileStore.upsertRecentFile(payload.data);
    }
});

useEcho<{ data: VaultNode }>(channel, 'VaultNodeUpdatedEvent', payload => {
    vaultTreeActions.handleNodeUpdated(payload.data);

    if (payload.data.is_file) {
        vaultRecentFileStore.upsertRecentFile(payload.data);

        if (openedFile.value?.file.id === payload.data.id) {
            if (openedFile.value?.file.name !== payload.data.name) {
                openedFile.value.file.name = payload.data.name;
            }

            if (openedFile.value?.file.parent_id !== payload.data.parent_id) {
                openedFile.value.file.parent_id = payload.data.parent_id;
            }

            if (
                payload.data.type === 'note' &&
                openedFile.value?.file.content !== payload.data.content
            ) {
                openedFile.value.file.content = payload.data.content;
                editorContext.value?.setContent(payload.data.content ?? '');
            }
        }
    }
});

useEcho<{ data: VaultOpenedFileData }>(
    channel,
    'VaultOpenedFileDataUpdatedEvent',
    payload => {
        if (openedFile.value?.file.id !== payload.data.file.id) {
            return;
        }

        vaultOpenedFileStore.set(payload.data.links, payload.data.backlinks, payload.data.tags);
    }
);

useEcho<{ data: { deleted_ids: number[] } }>(
    channel,
    'VaultNodeDeletedEvent',
    payload => {
        vaultActions.handleNodesDeleted(payload.data.deleted_ids);
    }
);

useEcho<{ data: VaultCollaborator }>(
    channel,
    'VaultCollaborationCreatedEvent',
    ({ data }) => {
        vaultStore.addCollaborator(data);
    }
);

useEcho<{ data: VaultCollaborator }>(
    channel,
    'VaultCollaborationAcceptedEvent',
    ({ data }) => {
        vaultStore.updateCollaborator(data);
    }
);

useEcho<{ data: { user_id: number } }>(
    channel,
    'VaultCollaborationDeletedEvent',
    ({ data }) => {
        vaultStore.removeCollaborator(data.user_id);
    }
);
</script>

<template>
    <Head :title="openedFile?.file.name || vaultStore.name || vault.name || 'Docs'" />

    <Teleport defer to="#app-header">
        <div class="flex shrink-0 items-center gap-1">
            <Link href="/vaults" aria-label="Docs home" title="Docs" class="inline-flex size-9 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-ring">
                <Doc class="size-4.5" />
            </Link>
            <button
                class="hover:bg-accent hover:text-accent-foreground inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors"
                type="button"
                aria-label="Toggle document tree"
                :aria-expanded="isLeftPanelOpen"
                @click="toggleLeftPanel(isSmallScreen)"
            >
                <Bars3BottomLeft class="size-4" />
            </button>
        </div>
        <div id="file-header" class="flex min-w-0 flex-1 items-center sm:hidden"></div>
        <div class="flex shrink-0 items-center gap-1">
            <button
                class="hover:bg-accent hover:text-accent-foreground inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors"
                type="button"
                aria-label="Search documents"
                @click="
                    openModal(VaultSearchModal, {
                        title: 'Search',
                        compact: true,
                        onSelect: (fileId: number) => vaultActions.openFile(fileId),
                    })
                "
            >
                <MagnifyingGlass class="size-4" />
            </button>
            <UserMenu />
        </div>
    </Teleport>

    <Transition
        enter-active-class="ease-out duration-300"
        leave-active-class="ease-in duration-200"
    >
        <div
            v-if="isSmallScreen && isLeftPanelOpen"
            class="bg-background/60 fixed inset-0 z-20 opacity-50"
            @click="closePanels"
        ></div>
    </Transition>

    <aside
        scroll-region
        class="bg-popover absolute top-0 bottom-0 left-0 z-30 w-[80%] max-w-[300px] overflow-y-auto rounded-r transition-all duration-300 ease-in-out lg:static lg:max-w-[300px] print:hidden"
        :class="{
            '-translate-x-full': isSmallScreen && !isLeftPanelOpen,
            'translate-x-0': isSmallScreen && isLeftPanelOpen,
            'lg:w-0 lg:min-w-0': !isLeftPanelOpen,
            'lg:w-[20%] lg:min-w-[240px]': isLeftPanelOpen,
        }"
    >
        <VaultTree
            :vault-id="props.vault.id"
            :vault-name="vault.name"
            :vault-created-by="props.vault.created_by"
        />
    </aside>

    <section
        ref="mainSectionRef"
        :aria-busy="layoutStore.isFileLoading"
        class="relative h-full min-w-0 max-w-full flex-1 transition-all duration-300 ease-in-out"
    >
        <div v-if="layoutStore.isFileLoading" role="status" aria-label="Loading document" class="pointer-events-none absolute inset-x-0 top-0 z-20 h-px animate-pulse bg-foreground/40 motion-reduce:animate-none"></div>
        <div
            class="mx-auto flex h-full w-full flex-col transition-all duration-300 ease-in-out"
            :class="layoutStore.isContentWidthFull ? 'max-w-full' : 'max-w-[48rem]'"
        >
            <VaultFile
                v-if="openedFile"
                :key="openedFile.file.id"
                :inert="layoutStore.isFileLoading"
                :node="openedFile.file"
                @close="vaultActions.closeFile"
                @name-updated="router.replaceProp('openedFile.file.name', $event)"
            >
                <template v-if="openedFile.file.type === 'note'" #toolbar>
                    <MarkdownToolbar :vault-id="props.vault.id" :node-id="openedFile.file.id" />
                </template>
                <component
                    :is="fileComponents[openedFile.file.type]"
                    v-if="openedFile.file.type !== 'folder'"
                    :node="openedFile.file"
                    @content-updated="router.replaceProp('openedFile.file.content', $event)"
                />
            </VaultFile>
            <div v-else class="flex h-full w-full flex-col">
                <div class="flex items-center justify-between gap-2 p-4">
                    <div class="text-lg font-semibold">Recent files</div>
                    <div class="flex items-center gap-2">
                        <VaultToggleContentWidthButton />

                        <button
                            type="button"
                            title="New note"
                            @click="
                                openModal(VaultNodeCreateModal, {
                                    title: 'New note',
                                    vaultId: props.vault.id,
                                    parentId: null,
                                    isFile: true,
                                })
                            "
                        >
                            <Plus class="h-5 w-5" />
                        </button>
                    </div>
                </div>
                <div class="-mt-2 flex w-full flex-grow flex-col overflow-y-auto px-4">
                    <template v-for="file in vaultRecentFileStore.recentFiles" :key="file.id">
                        <button
                            class="border-border hover:text-foreground flex w-full flex-col gap-2 border-b pt-2 pb-4 text-start last:border-b-0"
                            type="button"
                            @click="vaultActions.openFile(file.id)"
                        >
                            <span class="flex w-full items-center justify-between">
                                <span
                                    class="flex min-w-0 flex-1 items-center gap-2 py-1"
                                    :title="file.name"
                                >
                                    <span class="flex shrink-0 items-center justify-center gap-2">
                                        <VaultFileIcon :file="file" />
                                    </span>
                                    <span class="truncate">
                                        {{ file.name }}
                                    </span>
                                </span>
                                <span
                                    class="text-muted-foreground pl-2 text-xs"
                                    :title="formatExtendedDate(file.updated_at)"
                                >
                                    {{ formatElapsedTime(file.updated_at) }}
                                </span>
                            </span>
                            <span
                                class="text-muted-foreground truncate text-xs"
                                :title="file.full_path"
                            >
                                {{ file.full_path }}
                            </span>
                        </button>
                    </template>
                </div>
            </div>
        </div>
    </section>

</template>
