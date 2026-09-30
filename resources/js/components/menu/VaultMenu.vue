<script setup lang="ts">
import { destroy } from '@/actions/App/Http/Controllers/VaultController';
import RequestConfirmationModal from '@/components/modal/RequestConfirmationModal.vue';
import VaultEditModal from '@/components/modal/VaultEditModal.vue';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDownload } from '@/composables/useDownload';
import { useModalManager } from '@/composables/useModalManager';
import { useToast } from '@/composables/useToast';
import { exportMethod } from '@/routes/vaults';
import type { VaultListItem } from '@/types/vault';
import { Download, MoreHorizontal, Pencil, Trash2 } from 'lucide-vue-next';
import { watch } from 'vue';

const props = defineProps<{ vault: VaultListItem; owned: boolean }>();
const emit = defineEmits<{ changed: [] }>();
const { openModal } = useModalManager();
const { createToast } = useToast();
const { error, processing, download } = useDownload();
watch(error, message => {
    if (message) createToast(message, 'error');
});

function rename() {
    openModal(VaultEditModal, {
        title: 'Rename vault',
        id: props.vault.id,
        name: props.vault.name,
        onSuccess: () => emit('changed'),
    });
}

function remove() {
    openModal(RequestConfirmationModal, {
        title: 'Delete vault',
        url: destroy.url({ vault: props.vault.id }),
        method: 'delete',
        content: `Delete “${props.vault.name}” and all its documents? This cannot be undone.`,
        successMessage: 'Vault deleted',
        onSuccess: () => emit('changed'),
    });
}
</script>

<template>
    <DropdownMenu>
        <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon" :aria-label="`Actions for ${vault.name}`">
                <MoreHorizontal aria-hidden="true" class="size-4" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
            <DropdownMenuItem @select="rename">
                <Pencil />
                Rename vault
            </DropdownMenuItem>
            <DropdownMenuItem
                :disabled="processing"
                @select="download(exportMethod.url({ vault: vault.id }))"
            >
                <Download />
                {{ processing ? 'Exporting…' : 'Export' }}
            </DropdownMenuItem>
            <DropdownMenuItem
                v-if="owned"
                class="text-destructive focus:text-destructive"
                @select="remove"
            >
                <Trash2 />
                Delete
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
</template>
