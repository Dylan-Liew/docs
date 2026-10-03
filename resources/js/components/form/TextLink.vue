<script setup lang="ts">
import { Link } from '@inertiajs/vue3';

defineProps<{
    href: string;
    label: string;
}>();
</script>

<template>
    <Link :href="href" class="text-foreground hover:text-muted-foreground transition-colors focus-visible:outline-2 focus-visible:outline-ring">
        {{ label }}
    </Link>
</template>
