<script setup lang="ts">
import { update } from '@/actions/App/Http/Controllers/VaultController';
import ModelInput from '@/components/form/ModelInput.vue';
import Submit from '@/components/form/Submit.vue';
import { Button } from '@/components/ui/button';
import { useModalManager } from '@/composables/useModalManager';
import { useRequest } from '@/composables/useRequest';
import { useToast } from '@/composables/useToast';
import { VaultUpdated } from '@/types/vault.events';

const props = defineProps<{
    id: number;
    name: string;
    onSuccess?: (vault: VaultUpdated) => void;
}>();

const { closeModal } = useModalManager();
const { createToast } = useToast();

const form = useRequest<{ name: string }>({ name: props.name });

const url = update.url({ vault: props.id });

const handleSubmit = () => {
    form.patch(url, {
        onSuccess: (response: { data: VaultUpdated }) => {
            closeModal();
            createToast('Vault renamed', 'success');
            props.onSuccess?.(response.data);
        },
    });
};
</script>

<template>
    <form
        class="flex flex-col gap-6 inert:pointer-events-none"
        autocomplete="off"
        novalidate
        :inert="form.processing"
        @submit.prevent="handleSubmit"
    >
        <ModelInput
            v-model="form.name"
            name="name"
            type="text"
            label="Vault name"
            :error="form.errors.name"
            required
            autofocus
        />
        <div class="flex justify-end gap-2 py-1">
            <Button variant="outline" @click="closeModal">Cancel</Button>
            <Submit label="Rename" :processing="form.processing" />
        </div>
    </form>
</template>
