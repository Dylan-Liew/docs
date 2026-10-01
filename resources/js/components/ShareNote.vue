<script setup lang="ts">
import { useEditor } from '@/composables/useEditor';
import type { ShareFile, ShareNode } from '@/types/share';
import { computed, onMounted, ref } from 'vue';

const props = defineProps<{ node: ShareFile; base: string; vaultId?: number; nodes: ShareNode[] }>();
const emit = defineEmits<{ open: [path: string]; navigate: [url: string] }>();
const element = ref<HTMLElement | null>(null);
const files = new Set(props.nodes.filter(node => node.is_file).map(node => node.id));
const { editor } = useEditor({
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

function publicLink(href: string): string | undefined {
    if (props.vaultId === undefined) return;
    let target: URL;
    try { target = new URL(href, location.origin); } catch { return; }
    const file = target.searchParams.get('file');
    if (target.origin !== location.origin || target.pathname !== `/vaults/${props.vaultId}`
        || target.searchParams.size !== 1 || !file || !/^[1-9]\d*$/.test(file) || !files.has(Number(file))) return;
    const url = new URL(props.base, location.origin);
    url.searchParams.set('file', file);
    url.hash = target.hash;
    return url.href;
}

onMounted(() => {
    const instance = editor.value;
    if (!instance) return;
    // Rewrite marks only in the read-only view; stored Markdown stays intact.
    const { tr } = instance.state;
    instance.state.doc.descendants((node, pos) => {
        if (!node.isInline) return;
        for (const mark of node.marks) {
            if (mark.type.name !== 'link') continue;
            const href = publicLink(String(mark.attrs.href ?? ''));
            if (!href) continue;
            tr.removeMark(pos, pos + node.nodeSize, mark);
            tr.addMark(pos, pos + node.nodeSize, mark.type.create({ ...mark.attrs, href, target: '_self' }));
        }
    });
    if (tr.docChanged) instance.view.dispatch(tr.setMeta('addToHistory', false).setMeta('preventUpdate', true));
});

function openLink(event: MouseEvent) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element)?.closest<HTMLAnchorElement>('a[href]');
    if (!anchor) return;
    const url = new URL(anchor.href);
    if (url.origin !== location.origin || url.pathname !== props.base) return;
    event.preventDefault();
    event.stopPropagation();
    emit('navigate', url.href);
}
</script>

<template>
    <div ref="element" class="min-w-0 px-4 pb-8 sm:px-6" aria-label="Note content" @click.capture="openLink" />
</template>
