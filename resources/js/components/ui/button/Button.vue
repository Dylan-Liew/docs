<script setup lang="ts">
import { cn } from '@/lib/utils';
import { buttonVariants } from './variants';
import { type VariantProps } from 'class-variance-authority';
import { type HTMLAttributes, computed } from 'vue';

type ButtonVariants = VariantProps<typeof buttonVariants>;

const props = withDefaults(
    defineProps<{
        variant?: ButtonVariants['variant'];
        size?: ButtonVariants['size'];
        class?: HTMLAttributes['class'];
        type?: 'button' | 'submit' | 'reset';
    }>(),
    {
        variant: 'default',
        size: 'default',
        class: undefined,
        type: 'button',
    }
);

const classes = computed(() =>
    cn(buttonVariants({ variant: props.variant, size: props.size }), props.class)
);
</script>

<template>
    <button :type="type" :class="classes">
        <slot />
    </button>
</template>
