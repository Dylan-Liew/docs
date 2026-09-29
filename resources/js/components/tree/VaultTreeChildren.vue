<script setup lang="ts">
import { useVaultTreeStore } from '@/stores/vaultTree';
import { computed } from 'vue';
import VaultTreeNode from './VaultTreeNode.vue';

const props = defineProps<{ parentId: number; depth: number; expanded: boolean }>();
const tree = useVaultTreeStore();
const children = computed(() => tree.getChildren(props.parentId));
</script>

<template>
    <div v-if="expanded" role="group" :class="depth <= 5 ? 'border-border/60 ml-3 border-l pl-2' : 'pl-0'">
        <VaultTreeNode v-for="id in children" :key="id" :node-id="id" :depth="depth" />
        <p v-if="!children.length" class="text-muted-foreground px-3 py-2 text-xs">No sub-notes</p>
    </div>
</template>
