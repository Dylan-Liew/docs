<script setup lang="ts">
import VaultSearchController from '@/actions/App/Http/Controllers/VaultSearchController';
import Input from '@/components/ui/input/Input.vue';
import { Search } from 'lucide-vue-next';
import VaultFileIcon from '@/components/vault/VaultFileIcon.vue';
import { useModalManager } from '@/composables/useModalManager';
import { useRequest } from '@/composables/useRequest';
import { useVaultSearch } from '@/composables/useVaultSearch';
import { useVaultStore } from '@/stores/vault';
import { VaultSearchFile } from '@/types/vault';
import { computed, onMounted, ref } from 'vue';

const props = defineProps<{
    initialSearch?: string;
    onSelect: (fileId: number) => void;
}>();

const vaultStore = useVaultStore();
const { closeModal } = useModalManager();

const form = useRequest<{ search: string }>({ search: '' });

const files = ref<VaultSearchFile[]>([]);
const isLoading = ref(false);
const fileCount = computed(() => files.value.length);

const url = VaultSearchController.url({ vault: vaultStore.id! });

let requestId = 0;

function handleSubmit() {
    form.cancel();
    const currentRequest = ++requestId;

    if (!search.value) {
        hasSearched.value = false;
        files.value = [];
        isLoading.value = false;

        return;
    }

    isLoading.value = true;

    form.search = search.value;

    form.get<{ data: { files: VaultSearchFile[] } }>(url, {
        onSuccess: payload => {
            if (currentRequest === requestId) files.value = payload.data.files;
        },
        onFinish: () => {
            if (currentRequest !== requestId) {
                return;
            }

            isLoading.value = false;
        },
    });
}

function openFile() {
    if (files.value.length === 0) {
        return;
    }

    props.onSelect(files.value[selectedFile.value].id);

    closeModal();
}

const {
    search,
    hasSearched,
    selectedFile,
    listRef,
    scrollContainerRef,
    selectFile,
    selectPreviousFile,
    selectNextFile,
} = useVaultSearch(handleSubmit, fileCount);

onMounted(() => {
    search.value = props.initialSearch ?? '';
});
</script>

<template>
    <div ref="scrollContainerRef">
        <div class="flex h-12 items-center gap-2.5 pr-12 pl-3">
            <Search class="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
            <Input
                :value="search"
                @input="search = ($event.target as HTMLInputElement).value"
                name="search"
                type="text"
                placeholder="Find a document…"
                class="h-full min-w-0 rounded-none border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-sm"
                aria-label="Search documents"
                autocomplete="off"
                autofocus
                @keydown.up.prevent.stop="selectPreviousFile"
                @keydown.down.prevent.stop="selectNextFile"
                @keydown.enter.prevent.stop="openFile"
            />
        </div>
        <div v-if="files.length || hasSearched" class="border-t">
            <div
                v-if="files.length > 0"
                ref="listRef"
                class="flex flex-col"
                :class="[isLoading ? 'opacity-50' : '']"
            >
                <div
                    v-for="(file, index) in files"
                    :key="file.id"
                    :class="
                        selectedFile === index
                            ? 'bg-secondary text-foreground'
                            : 'text-muted-foreground'
                    "
                    @mouseenter="selectFile(index)"
                >
                    <button
                        class="focus-visible:bg-accent flex min-h-11 w-full flex-col gap-0.5 px-3 py-2 text-left outline-none"
                        type="button"
                        @click="
                            selectFile(index);
                            openFile();
                        "
                    >
                        <span class="flex w-full items-center justify-between">
                            <span
                                class="flex min-w-0 flex-1 items-center gap-2.5"
                                :title="file.full_path"
                            >
                                <span class="flex shrink-0 items-center justify-center gap-2">
                                    <VaultFileIcon :file="file" />
                                </span>
                                <!-- eslint-disable-next-line vue/no-v-html -->
                                <span class="truncate" v-html="file.name"></span>
                            </span>
                        </span>
                        <!-- eslint-disable vue/no-v-html -->
                        <span
                            class="text-muted-foreground truncate pl-6.5 text-xs"
                            v-html="file.content"
                        ></span>
                        <!-- eslint-enable vue/no-v-html -->
                    </button>
                </div>
            </div>
            <p v-else class="text-muted-foreground px-3 py-3 text-sm" role="status">
                {{ isLoading ? 'Searching…' : 'No results found' }}
            </p>
        </div>
    </div>
</template>
