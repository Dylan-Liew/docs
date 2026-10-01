<script setup lang="ts">
import { useEditor } from '@/composables/useEditor';
import type { ShareFile } from '@/types/share';
import { computed, ref } from 'vue';

const props = defineProps<{ node: ShareFile; base: string }>();
const emit = defineEmits<{ open: [path: string] }>();
const element = ref<HTMLElement | null>(null);
useEditor({
    vaultId: 'public',
    readonly: true,
    fileUrl: `${props.base}/files?node=${props.node.id}&path=`,
    element,
    markdownElement: ref<HTMLTextAreaElement | null>(null),
    content: props.node.content ?? '',
    isEditMode: computed(() => false),
    onUpdate: () => {},
    openFilePath: path => emit('open', path),
    uploadFiles: request => request.onFinish(),
});
</script>

<template>
    <div ref="element" class="min-w-0 px-4 pb-8 sm:px-6" aria-label="Note content" />
</template>
