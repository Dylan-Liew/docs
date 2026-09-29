<script setup lang="ts">
import { useTheme } from '@/composables/useTheme';
import { Toaster } from 'vue-sonner';
import 'vue-sonner/style.css';

const { isDark } = useTheme();
</script>

<template>
    <Toaster
        :theme="isDark ? 'dark' : 'light'"
        position="bottom-right"
        close-button
        :toast-options="{
            classes: {
                toast: '!bg-popover !text-popover-foreground !border-border !rounded-md',
            },
        }"
    />
</template>
