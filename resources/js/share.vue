<script setup lang="ts">
import { Button } from '@/components/ui/button';
import ShareNote from '@/components/ShareNote.vue';
import ShareTree from '@/components/ShareTree.vue';
import Doc from '@/icons/Doc.vue';
import { useTheme } from '@/composables/useTheme';
import { Moon, PanelLeft, Sun } from 'lucide-vue-next';
import type { ShareData } from '@/types/share';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps<ShareData>();
const data = ref<ShareData>({ ...props });
const panel = ref(false);
const loading = ref(false);
const message = ref('');
const { isDark, toggleTheme } = useTheme();
const base = props.base ?? location.pathname;
const selected = computed(() => data.value.selected);
let request: AbortController | undefined;
let sequence = 0;

async function navigate(url: string, history = true) {
    const target = new URL(url, location.origin);
    if (target.origin !== location.origin || target.pathname !== base) return;
    request?.abort();
    const controller = new AbortController();
    request = controller;
    const current = ++sequence;
    loading.value = true;
    message.value = '';
    try {
        const response = await fetch(target, { headers: { Accept: 'application/json' }, signal: controller.signal });
        const payload: ShareData = await response.json();
        if (current !== sequence) return;
        if (!response.ok && !payload.error) throw new Error();
        data.value = payload;
        panel.value = false;
        if (history) window.history.pushState(null, '', target);
        await nextTick();
        if (current === sequence) document.getElementById('share-content')?.scrollTo(0, 0);
    } catch {
        if (!controller.signal.aborted) message.value = 'Could not load this note. Try again.';
    } finally {
        if (current === sequence) loading.value = false;
    }
}
function openPath(path: string) {
    const query = new URLSearchParams({ path });
    if (selected.value) query.set('file', String(selected.value.id));
    void navigate(`${base}?${query}`);
}
function pop() { void navigate(location.href, false); }
window.addEventListener('popstate', pop);
onBeforeUnmount(() => { request?.abort(); window.removeEventListener('popstate', pop); });
watch(() => selected.value?.name ?? data.value.name, title => { document.title = title || 'Docs'; }, { immediate: true });
</script>

<template>
    <div class="bg-background text-foreground flex h-dvh min-w-0 flex-col">
        <header class="border-border flex h-15 shrink-0 items-center gap-2 border-b px-4">
            <a :href="base" aria-label="Shared vault" class="inline-flex size-9 shrink-0 items-center justify-center rounded-md hover:bg-accent" @click.prevent="navigate(base)"><Doc class="size-4" /></a>
            <Button v-if="!data.error" variant="ghost" size="icon" class="sm:hidden" aria-label="Toggle document list" :aria-expanded="panel" @click="panel = !panel"><PanelLeft class="size-4" /></Button>
            <h1 class="min-w-0 flex-1 truncate text-base font-semibold" :title="selected?.name || data.name">{{ selected?.name || data.name || 'Docs' }}</h1>
            <Button variant="ghost" size="icon" aria-label="Toggle theme" :title="isDark ? 'Light mode' : 'Dark mode'" @click="toggleTheme"><Sun v-if="isDark" class="size-4" /><Moon v-else class="size-4" /></Button>
        </header>
        <div v-if="data.error" class="flex flex-1 items-center justify-center p-6"><p role="alert" class="text-muted-foreground text-sm">{{ data.error }}</p></div>
        <div v-else class="flex min-h-0 min-w-0 flex-1">
            <aside class="border-border w-full shrink-0 flex-col overflow-y-auto p-3 sm:w-64 sm:border-r" :class="panel || !selected ? 'flex' : 'hidden sm:flex'">
                <nav aria-label="Documents"><ShareTree :nodes="data.nodes ?? []" :base="base" :selected="selected?.id" @open="navigate($event)" /></nav>
                <p v-if="!data.nodes?.length" class="text-muted-foreground p-3 text-sm">No notes yet</p>
            </aside>
            <main id="share-content" class="min-h-0 min-w-0 flex-1 flex-col overflow-y-auto" :class="panel || !selected ? 'hidden sm:flex' : 'flex'" :aria-busy="loading">
                <p v-if="message" role="alert" class="text-destructive px-4 py-3 text-sm">{{ message }}</p>
                <p v-if="!selected" class="text-muted-foreground m-auto p-6 text-sm">Choose a note</p>
                <div v-else class="mx-auto w-full max-w-4xl py-5">
                    <ShareNote v-if="selected.type === 'note'" :key="selected.id" :node="selected" :base="base" :vault-id="data.vaultId" :nodes="data.nodes ?? []" @open="openPath" @navigate="navigate" />
                    <img v-else-if="selected.type === 'image'" :src="selected.url" :alt="selected.name" class="mx-auto max-w-full px-4" />
                    <video v-else-if="selected.type === 'video'" :src="selected.url" controls class="w-full px-4" />
                    <audio v-else-if="selected.type === 'audio'" :src="selected.url" controls class="w-full px-4" />
                    <object v-else-if="selected.type === 'pdf'" :data="selected.url" type="application/pdf" class="h-[70dvh] w-full"><a :href="selected.url" class="px-4 text-sm">Open PDF</a></object>
                </div>
            </main>
        </div>
    </div>
</template>
