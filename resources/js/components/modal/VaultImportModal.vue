<script setup lang="ts">
import VaultImportController from '@/actions/App/Http/Controllers/VaultImportController';
import { useModalManager } from '@/composables/useModalManager';
import { useRequest } from '@/composables/useRequest';
import { useToast } from '@/composables/useToast';
import { router, usePage } from '@inertiajs/vue3';
import { computed, ref } from 'vue';

const page = usePage();
const { closeModal } = useModalManager();
const { createToast } = useToast();

const form = useRequest<{ file: File | null }>({ file: null });
const fileUpload = ref<HTMLInputElement | null>(null);

const uploadMaxFilesize = computed(() => page.props.app?.metadata?.upload_max_filesize ?? '0');
const uploadMaxFilesizeBytes = computed(
    () => page.props.app?.metadata?.upload_max_filesize_bytes ?? 0
);

const handleSubmit = () => {
    if (form.processing || !fileUpload.value?.files?.length) {
        return;
    }

    const file = fileUpload.value.files[0];

    const extension = file.name.split('.').pop()?.toLowerCase();
    const invalidExtension = !extension || extension !== 'zip';
    const invalidSize = file.size > uploadMaxFilesizeBytes.value;

    if (invalidExtension || invalidSize) {
        createToast(invalidExtension ? 'Choose a ZIP archive to import.' : `Choose a file smaller than ${uploadMaxFilesize.value}.`, 'error');

        return;
    }

    form.file = file;

    form.post(VaultImportController.url(), {
        onSuccess: () => {
            closeModal();
            createToast('Vault imported', 'success');
            router.reload({ only: ['visibleVaults', 'recentDocuments'] });
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
        <div
            class="border-border focus-within:ring-ring flex min-h-48 w-full flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-5 focus-within:ring-2"
        >
            <label
                for="file-upload"
                class="flex w-full cursor-pointer flex-col items-center justify-center gap-2 text-sm font-medium"
            >
                <span class="font-semibold">Import a vault from a ZIP archive</span>
                <span class="text-sm">ZIP files up to {{ uploadMaxFilesize }}</span>

                <p v-if="form.errors.file" class="text-error-500 text-sm">
                    {{ form.errors.file }}
                </p>

                <progress
                    v-if="form.progress"
                    class="mt-2 h-1 w-64"
                    :value="form.progress.percentage"
                    max="100"
                    aria-label="Upload progress"
                >
                    {{ form.progress.percentage }}%
                </progress>
            </label>

            <input
                id="file-upload"
                ref="fileUpload"
                type="file"
                accept="application/zip"
                class="text-muted-foreground w-full max-w-sm text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-foreground"
                @change="handleSubmit"
            />
        </div>
    </form>
</template>
