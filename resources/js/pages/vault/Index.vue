<script setup lang="ts">
import UserMenu from '@/components/menu/UserMenu.vue';
import VaultMenu from '@/components/menu/VaultMenu.vue';
import VaultCreateModal from '@/components/modal/VaultCreateModal.vue';
import VaultImportModal from '@/components/modal/VaultImportModal.vue';
import { Button } from '@/components/ui/button';
import { useModalManager } from '@/composables/useModalManager';
import Doc from '@/icons/Doc.vue';
import AuthLayout from '@/layouts/AuthLayout.vue';
import type { HomeDocument, VaultListItem } from '@/types/vault';
import { Head, Link, router, usePage } from '@inertiajs/vue3';
import { useEcho } from '@laravel/echo-vue';
import {
    ArrowUpRight,
    FileText,
    Folder,
    LockKeyhole,
    Plus,
    Search,
    Upload,
    Users,
    X
} from 'lucide-vue-next';
import { computed, ref } from 'vue';

defineOptions({ layout: AuthLayout });
const props = defineProps<{
    visibleVaults: VaultListItem[];
    recentDocuments: HomeDocument[];
}>();
const page = usePage();
const { openModal } = useModalManager();
const userId = computed(() => page.props.app?.user?.id);
const search = ref('');
const filteredVaults = computed(() => {
    const query = search.value.trim().toLocaleLowerCase();
    return props.visibleVaults
        .filter((vault) => vault.name.toLocaleLowerCase().includes(query))
        .sort((a, b) =>
            a.name.localeCompare(b.name, undefined, {
                numeric: true,
                sensitivity: 'base'
            })
        );
});
const date = (value: string) =>
    new Date(value).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
    });
const fullDate = (value: string) => new Date(value).toLocaleString();
const refresh = () => router.reload({ only: ['visibleVaults', 'recentDocuments'] });
const create = () => openModal(VaultCreateModal, { title: 'Create vault' });

useEcho(`User.${userId.value}`, 'VaultListUpdatedEvent', refresh);
</script>

<template>
    <Head title="Docs" />
    <Teleport defer to="#app-header">
        <Link
            href="/vaults"
            aria-label="Docs home"
            title="Docs home"
            class="flex size-9 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-ring"
        >
            <Doc class="size-4.5" aria-hidden="true" />
        </Link>
        <UserMenu />
    </Teleport>

    <div class="min-w-0 flex-1 overflow-y-auto">
        <div
            class="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-3 px-4 py-3 sm:block sm:space-y-10 sm:px-8 sm:py-10"
        >
            <section
                class="contents sm:flex sm:items-center sm:justify-between sm:gap-4"
                aria-labelledby="home-title"
            >
                <h1
                    id="home-title"
                    class="sr-only font-semibold tracking-tight sm:not-sr-only sm:text-3xl"
                >
                    Workspace
                </h1>
                <div class="col-start-2 row-start-1 flex shrink-0 items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        class="size-11"
                        aria-label="Import"
                        title="Import vault"
                        @click="
                            openModal(VaultImportModal, {
                                title: 'Import vault'
                            })
                        "
                    >
                        <Upload class="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                        size="icon"
                        class="size-11"
                        aria-label="New vault"
                        title="New vault"
                        @click="create"
                    >
                        <Plus class="size-4" aria-hidden="true" />
                    </Button>
                </div>
            </section>

            <section
                v-if="recentDocuments.length"
                class="hidden sm:block"
                aria-labelledby="recent-title"
            >
                <div class="mb-4 flex items-baseline justify-between gap-3">
                    <h2 id="recent-title" class="text-sm font-semibold">Recent</h2>
                </div>
                <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <Link
                        v-for="document in recentDocuments"
                        :key="document.id"
                        :href="`/vaults/${document.vault_id}?file=${document.id}`"
                        :aria-label="`Open ${document.name} in ${document.vault_name}`"
                        class="group hover:bg-accent/60 focus-visible:ring-ring flex min-w-0 items-start gap-3 rounded-lg border px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none sm:py-4"
                    >
                        <FileText
                            class="text-muted-foreground mt-0.5 size-4 shrink-0"
                            aria-hidden="true"
                        />
                        <div class="min-w-0 flex-1">
                            <p class="truncate text-sm font-medium" :title="document.name">
                                {{ document.name }}
                            </p>
                            <p class="text-muted-foreground mt-1.5 flex items-center gap-2 text-xs">
                                <span class="truncate" :title="document.vault_name">
                                    {{ document.vault_name }}
                                </span>
                                <span aria-hidden="true">·</span>
                                <time
                                    :datetime="document.updated_at"
                                    :title="fullDate(document.updated_at)"
                                    class="shrink-0"
                                >
                                    {{ date(document.updated_at) }}
                                </time>
                            </p>
                        </div>
                        <ArrowUpRight
                            class="text-muted-foreground size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                            aria-hidden="true"
                        />
                    </Link>
                </div>
            </section>

            <section class="contents sm:block" aria-labelledby="vaults-title">
                <div
                    class="col-start-1 row-start-1 flex min-w-0 flex-col sm:mb-4 sm:flex-row sm:items-end sm:justify-between"
                >
                    <h2 id="vaults-title" class="sr-only text-sm font-semibold sm:not-sr-only">
                        Vaults
                    </h2>
                    <div v-if="visibleVaults.length" class="flex items-center gap-2">
                        <div class="relative min-w-0 flex-1 sm:w-52">
                            <Search
                                class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                                aria-hidden="true"
                            />
                            <input
                                v-model="search"
                                type="search"
                                aria-label="Find a vault"
                                placeholder="Find a vault…"
                                class="bg-background placeholder:text-muted-foreground focus-visible:ring-ring h-11 w-full rounded-md border pr-3 pl-9 text-sm focus-visible:ring-2 focus-visible:outline-none sm:h-9"
                            />
                        </div>
                    </div>
                </div>

                <ul
                    v-if="filteredVaults.length"
                    class="col-span-2 divide-y overflow-hidden rounded-lg border"
                >
                    <li
                        v-for="vault in filteredVaults"
                        :key="vault.id"
                        class="hover:bg-accent/50 flex min-w-0 items-center gap-1 pr-2 transition-colors sm:pr-3"
                    >
                        <Link
                            :href="`/vaults/${vault.id}`"
                            :aria-label="`Open ${vault.name}`"
                            class="focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-3 px-3 py-3 focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none sm:gap-4 sm:px-4 sm:py-4"
                        >
                            <span
                                class="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg sm:size-10"
                            >
                                <Folder
                                    class="text-muted-foreground size-4 sm:size-5"
                                    aria-hidden="true"
                                />
                            </span>
                            <div class="min-w-0 flex-1">
                                <p class="truncate text-sm font-medium" :title="vault.name">
                                    {{ vault.name }}
                                </p>
                                <p
                                    class="text-muted-foreground mt-1 flex items-center gap-2 text-xs"
                                >
                                    <span
                                        role="img"
                                        :aria-label="`${vault.documents_count} ${vault.documents_count === 1 ? 'document' : 'documents'}`"
                                        :title="`${vault.documents_count} ${vault.documents_count === 1 ? 'document' : 'documents'}`"
                                        class="inline-flex items-center gap-1"
                                    >
                                        <FileText class="size-3" aria-hidden="true" />
                                        <span aria-hidden="true">{{ vault.documents_count }}</span>
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span
                                        v-if="
                                            vault.accepted_collaborators_count ||
                                            vault.created_by !== userId
                                        "
                                        role="img"
                                        aria-label="Shared"
                                        title="Shared"
                                        class="inline-flex items-center gap-1"
                                    >
                                        <Users class="size-3" aria-hidden="true" />
                                    </span>
                                    <span v-else role="img" aria-label="Private" title="Private">
                                        <LockKeyhole class="size-3" aria-hidden="true" />
                                    </span>
                                </p>
                            </div>
                            <time
                                :datetime="vault.activity_at"
                                :title="fullDate(vault.activity_at)"
                                class="text-muted-foreground hidden shrink-0 text-xs sm:block"
                            >
                                {{ date(vault.activity_at) }}
                            </time>
                        </Link>
                        <VaultMenu
                            :vault="vault"
                            :owned="vault.created_by === userId"
                            @changed="refresh"
                        />
                    </li>
                </ul>
                <div
                    v-else-if="visibleVaults.length"
                    class="col-span-2 rounded-lg border border-dashed px-5 py-12 text-center"
                    role="status"
                >
                    <p class="text-sm font-medium">No matching vaults</p>
                    <p class="text-muted-foreground mt-2 text-sm">
                        Try a different name, or clear your search.
                    </p>
                    <Button class="mt-4" variant="outline" @click="search = ''">
                        <X class="size-4" aria-hidden="true" />
                        Clear search
                    </Button>
                </div>
                <div
                    v-else
                    class="col-span-2 flex flex-col items-center rounded-lg border border-dashed px-5 py-14 text-center"
                >
                    <Folder class="text-muted-foreground mb-5 size-8" aria-hidden="true" />
                    <h3 class="text-base font-semibold">No vaults yet</h3>
                    <p class="text-muted-foreground mt-2 max-w-sm text-sm leading-6">
                        Create a vault to start writing.
                    </p>
                    <Button class="mt-5" @click="create">
                        <Plus class="size-4" aria-hidden="true" />
                        Create your first vault
                    </Button>
                </div>
            </section>
        </div>
    </div>
</template>
