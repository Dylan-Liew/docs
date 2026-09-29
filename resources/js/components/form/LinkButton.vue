<script setup lang="ts">
import { Link } from '@inertiajs/vue3';

defineProps<{
    href: string;
    primary?: boolean;
    full?: boolean;
}>();
</script>

<template>
    <Link
        :href="href"
        :class="[
            'flex items-center gap-2 rounded-md border px-2 py-1.5',
            primary
                ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                : 'border-input bg-secondary hover:bg-accent text-foreground',
            full ? 'w-full justify-center' : '',
        ]"
    >
        <slot />
    </Link>
</template>
