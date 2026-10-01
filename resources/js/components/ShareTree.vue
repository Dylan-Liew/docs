<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { ChevronRight, FileText, Folder } from 'lucide-vue-next';
import type { ShareNode } from '@/types/share';
import { computed, ref, watch } from 'vue';

const props = withDefaults(defineProps<{ nodes: ShareNode[]; base: string; selected?: number; parent?: number | null }>(), { parent: null });
const emit = defineEmits<{ open: [url: string] }>();
const expanded = ref(new Set<number>());
const children = computed(() => props.nodes.filter(node => node.parent_id === props.parent));
const hasChildren = (id: number) => props.nodes.some(node => node.parent_id === id);
watch(() => props.selected, id => {
    let node = props.nodes.find(item => item.id === id);
    const seen = new Set<number>();
    while (node?.parent_id && !seen.has(node.parent_id)) {
        seen.add(node.parent_id);
        expanded.value.add(node.parent_id);
        node = props.nodes.find(item => item.id === node?.parent_id);
    }
}, { immediate: true });
function toggle(id: number) {
    if (expanded.value.has(id)) expanded.value.delete(id);
    else expanded.value.add(id);
}
function open(event: MouseEvent, url: string) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    emit('open', url);
}
</script>

<template>
    <ul class="min-w-0 space-y-0.5">
        <li v-for="node in children" :key="node.id" class="min-w-0">
            <div class="flex min-h-11 min-w-0 items-center gap-1 rounded-md sm:min-h-9" :class="selected === node.id ? 'bg-[#27272a] text-[#fafafa]' : 'hover:bg-muted/50'">
                <Button v-if="hasChildren(node.id)" variant="ghost" size="icon" class="size-7 shrink-0" :aria-label="`${expanded.has(node.id) ? 'Collapse' : 'Expand'} ${node.name}`" :aria-expanded="expanded.has(node.id)" @click="toggle(node.id)"><ChevronRight class="size-3.5" :class="expanded.has(node.id) ? 'rotate-90' : ''" /></Button>
                <span v-else class="w-7 shrink-0" />
                <a v-if="node.is_file" :href="`${base}?file=${node.id}`" :aria-current="selected === node.id ? 'page' : undefined" :title="node.name" class="flex min-w-0 flex-1 items-center gap-2 py-2 pr-2 text-sm" @click="open($event, `${base}?file=${node.id}`)"><FileText class="size-4 shrink-0 text-muted-foreground" /><span class="truncate">{{ node.name }}</span></a>
                <button v-else class="flex min-w-0 flex-1 items-center gap-2 py-2 pr-2 text-left text-sm" :title="node.name" :aria-expanded="expanded.has(node.id)" @click="toggle(node.id)"><Folder class="size-4 shrink-0 text-muted-foreground" /><span class="truncate">{{ node.name }}</span></button>
            </div>
            <ShareTree v-if="expanded.has(node.id)" :nodes="nodes" :base="base" :selected="selected" :parent="node.id" class="ml-4" @open="emit('open', $event)" />
        </li>
    </ul>
</template>
