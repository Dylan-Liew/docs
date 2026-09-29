<script setup lang="ts">
import { type Component } from 'vue';

const props = defineProps<{
    text: string;
    link: string;
    icon: Component;
}>();
</script>

<template>
    <a
        :href="props.link"
        target="_blank"
        rel="noreferrer"
        class="dark:hover:bg-secondary border-input flex items-center justify-between gap-4 rounded-[10px] border px-3.5 py-2.5 hover:bg-neutral-50"
    >
        <span class="flex flex-col gap-0.5">
            <span class="text-foreground/80 dark:text-foreground text-sm font-semibold">
                {{ props.text }}
            </span>
            <span class="text-muted-foreground text-[0.8em]">
                {{ props.link }}
            </span>
        </span>
        <component :is="icon" v-if="icon" class="h-4.5 w-4.5" />
    </a>
</template>
