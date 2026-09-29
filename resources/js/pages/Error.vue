<script setup lang="ts">
import TextLink from '@/components/form/TextLink.vue';
import AuthLayout from '@/layouts/AuthLayout.vue';
import { Head } from '@inertiajs/vue3';
import { computed } from 'vue';

defineOptions({ layout: AuthLayout });

const props = defineProps<{
    status: number;
}>();

const titles: Record<number, string> = {
    403: 'Forbidden',
    404: 'Page not found',
    419: 'Page expired',
    500: 'Server error',
    503: 'Service unavailable',
};

const descriptions: Record<number, string> = {
    403: 'Your identity could not be verified, or you do not have access to this item. Sign in through Cloudflare Access or ask the vault owner for access.',
    404: "The page you're looking for doesn't exist.",
    419: 'Your session has expired. Please sign in again.',
    500: 'Something went wrong on our end.',
    503: 'The app is temporarily unavailable. Please try again shortly.',
};

const title = computed(() => titles[props.status] ?? 'Something went wrong');
const description = computed(() => descriptions[props.status] ?? 'An unexpected error occurred.');
</script>

<template>
    <Head :title="title" />

    <div class="flex min-w-0 flex-1 items-center justify-center overflow-y-auto p-6">
        <section class="w-full max-w-md text-center" aria-labelledby="error-title">
            <p class="text-muted-foreground text-sm font-medium">{{ status }}</p>
            <h1 id="error-title" class="mt-3 text-2xl font-semibold tracking-tight">{{ title }}</h1>
            <p class="text-muted-foreground mt-3 text-sm leading-6">{{ description }}</p>
            <div class="mt-6 flex flex-wrap items-center justify-center gap-5 text-sm">
                <TextLink href="/" label="Back to Docs" />
                <TextLink v-if="status === 403" href="/cdn-cgi/access/logout" label="Switch account" />
            </div>
        </section>
    </div>
</template>
