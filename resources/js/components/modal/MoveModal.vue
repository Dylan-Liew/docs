<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ChevronLeft, ChevronRight, FileText, Folder } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { useModalManager } from '@/composables/useModalManager';
import { useRequest } from '@/composables/useRequest';
import { useVaultActions } from '@/composables/useVaultActions';
import { useLayoutStore } from '@/stores/layout';
import type { VaultNodeTreeItem } from '@/types/vault';

const props = defineProps<{ node: VaultNodeTreeItem }>();
const { closeModal } = useModalManager();
const actions = useVaultActions();
const layout = useLayoutStore();
const form = useRequest({});
const path = ref<VaultNodeTreeItem[]>([]);
const nodes = ref<VaultNodeTreeItem[]>([]);
const error = ref('');
const parent = computed(() => path.value.at(-1)?.id ?? null);
const destinations = computed(() => nodes.value.filter(node => node.id !== props.node.id && (!node.is_file || node.type === 'note'))
    .sort((a, b) => a.name.localeCompare(b.name)));

function load(next: VaultNodeTreeItem[]) {
    const id = next.at(-1)?.id;
    error.value = '';
    form.get<{ children: VaultNodeTreeItem[] }>(`/vaults/${props.node.vault_id}/nodes${id ? `/${id}/children` : ''}`, {
        onSuccess: result => { path.value = next; nodes.value = result.children; },
        onFailure: message => { error.value = message; },
    });
}
onMounted(() => load([]));
</script>

<template>
    <div class="flex min-h-0 flex-col gap-3" :aria-busy="form.processing || layout.isTreeViewLoading">
        <div class="flex min-w-0 items-center gap-2 border-b pb-2">
            <Button variant="ghost" size="icon" aria-label="Parent location" :disabled="!path.length || form.processing" @click="load(path.slice(0, -1))"><ChevronLeft class="size-4" /></Button>
            <span class="truncate text-sm" :title="path.map(node => node.name).join(' / ')">{{ path.at(-1)?.name || 'Vault root' }}</span>
        </div>
        <div class="max-h-[45dvh] min-h-24 overflow-y-auto" :inert="form.processing || layout.isTreeViewLoading">
            <p v-if="error" role="alert" class="text-destructive p-3 text-sm">{{ error }} <button class="underline" @click="load(path)">Retry</button></p>
            <p v-else-if="form.processing" role="status" class="text-muted-foreground p-3 text-sm">Loading…</p>
            <template v-else>
                <p v-if="!destinations.length" class="text-muted-foreground px-3 py-2 text-sm">Move here or choose a parent location.</p>
                <button v-for="node in destinations" :key="node.id" class="hover:bg-accent focus-visible:bg-accent flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm outline-none"
                    :aria-label="`Open ${node.name}`" @click="load([...path, node])">
                    <component :is="node.is_file ? FileText : Folder" class="text-muted-foreground size-4 shrink-0" />
                    <span class="min-w-0 flex-1 truncate">{{ node.name }}</span><ChevronRight class="text-muted-foreground size-4 shrink-0" />
                </button>
            </template>
        </div>
        <div class="flex justify-end gap-2 border-t pt-3">
            <Button variant="outline" :disabled="layout.isTreeViewLoading" @click="closeModal">Cancel</Button>
            <Button :disabled="form.processing || !!error || layout.isTreeViewLoading || parent === node.parent_id" @click="actions.moveNode(node.id, parent, closeModal)">{{ layout.isTreeViewLoading ? 'Moving…' : 'Move here' }}</Button>
        </div>
    </div>
</template>
