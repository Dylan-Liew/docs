<script setup lang="ts">
import Submit from '@/components/form/Submit.vue';
import { Button } from '@/components/ui/button';
import { useModalManager } from '@/composables/useModalManager';
import { useRequest } from '@/composables/useRequest';
import { useToast } from '@/composables/useToast';
import { ref } from 'vue';

const props = defineProps<{
    url: string;
    method: 'delete';
    content: string;
    successMessage: string;
    label?: string;
    onSuccess?: (response: unknown) => void;
}>();

const { closeModal } = useModalManager();
const { createToast } = useToast();

const form = useRequest({});
const error = ref('');

const handleSubmit = () => {
    error.value = '';
    form[props.method](props.url, {
        onInvalid: errors => {
            const message = Object.values(errors).at(0);

            if (typeof message === 'string') {
                error.value = message;
                createToast(message, 'error');
            }
        },
        onFailure: message => { error.value = message; },
        onSuccess: response => {
            closeModal();
            createToast(props.successMessage, 'success');
            props.onSuccess?.(response);
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
        <p>{{ content }}</p>
        <p v-if="error" role="alert" class="text-destructive text-sm">{{ error }}</p>
        <div class="flex justify-end gap-2 py-1">
            <Button variant="outline" class="min-h-11" autofocus @click="closeModal">Cancel</Button>
            <Submit :label="label ?? 'Delete'" class="min-h-11 bg-destructive text-white hover:bg-destructive/90" :processing="form.processing" />
        </div>
    </form>
</template>
