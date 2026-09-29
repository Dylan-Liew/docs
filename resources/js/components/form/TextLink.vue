<script setup lang="ts">
import { Link } from '@inertiajs/vue3';

defineProps<{
    href: string;
    label: string;
}>();
</script>

<template>
    <Link :href="href" class="text-foreground hover:text-foreground underline underline-offset-2">
        {{ label }}
    </Link>
</template>
