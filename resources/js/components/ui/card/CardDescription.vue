<script setup lang="ts">
import { cn } from '@/lib/utils';
import { type HTMLAttributes, computed } from 'vue';

const props = defineProps<{ class?: HTMLAttributes['class'] }>();

const classes = computed(() => cn('text-muted-foreground text-sm', props.class));
</script>

<template>
    <p :class="classes">
        <slot />
    </p>
</template>
