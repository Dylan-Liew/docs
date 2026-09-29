<script setup lang="ts">
import { cn } from '@/lib/utils';
import { type HTMLAttributes, computed } from 'vue';

const props = defineProps<{ class?: HTMLAttributes['class'] }>();

const classes = computed(() =>
    cn('text-lg font-semibold leading-none tracking-tight', props.class)
);
</script>

<template>
    <h3 :class="classes">
        <slot />
    </h3>
</template>
