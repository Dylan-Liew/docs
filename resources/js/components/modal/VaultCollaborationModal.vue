<script setup lang="ts">
import { destroy, index, store, update } from '@/actions/App/Http/Controllers/VaultCollaborationController';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button/variants';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Input from '@/components/ui/input/Input.vue';
import { Check, ChevronDown, Copy, ExternalLink, Search, Unlink } from 'lucide-vue-next';
import { TabsRoot, TabsList, TabsTrigger, TabsContent, type AcceptableValue } from 'reka-ui';
import { useModalManager } from '@/composables/useModalManager';
import { useRequest } from '@/composables/useRequest';
import Trash from '@/icons/Trash.vue';
import { useVaultStore } from '@/stores/vault';
import { VaultCollaborator, VaultUser } from '@/types/vault';
import { usePage } from '@inertiajs/vue3';
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';
import RequestConfirmationModal from './RequestConfirmationModal.vue';

const props = defineProps<{
    vaultId: number;
}>();

const vaultStore = useVaultStore();
const page = usePage();
const { openModal } = useModalManager();

const form = useRequest<{ email: string }>({ email: '' });
const access = useRequest({ is_public: vaultStore.isPublic });
const accessError = ref('');
const link = useRequest({});
const linkError = ref('');
const copied = ref(false);
let copyTimer: ReturnType<typeof setTimeout> | undefined;
onBeforeUnmount(() => clearTimeout(copyTimer));
function changeLink(enabled: boolean) {
    if (link.processing) return;
    linkError.value = '';
    copied.value = false;
    link[enabled ? 'post' : 'delete']<{ data: { share_url: string | null } }>(`/vaults/${props.vaultId}/share`, {
        onSuccess: ({ data }) => { vaultStore.shareUrl = data.share_url; },
        onFailure: message => { linkError.value = message; },
        onInvalid: () => { linkError.value = 'Could not update the link. Try again.'; },
    });
}
async function copyLink() {
    if (!vaultStore.shareUrl) return;
    linkError.value = '';
    try {
        await navigator.clipboard.writeText(vaultStore.shareUrl);
        copied.value = true;
        clearTimeout(copyTimer);
        copyTimer = setTimeout(() => { copied.value = false; }, 2000);
    } catch {
        linkError.value = 'Could not copy the link. Select it and copy manually.';
    }
}
function changeAccess(value: AcceptableValue) {
    if (value !== 'public' && value !== 'restricted') return;
    if (access.processing || (value === 'public') === access.is_public) return;
    access.is_public = value === 'public';
    accessError.value = '';
    access.patch<{ data: { is_public: boolean } }>(update.url({ vault: props.vaultId }), {
        onSuccess: ({ data }) => { vaultStore.isPublic = data.is_public; },
        onFailure: message => { accessError.value = message; },
        onInvalid: () => { accessError.value = 'Could not update access. Try again.'; },
        onFinish: () => { access.is_public = vaultStore.isPublic; },
    });
}
watch(() => vaultStore.isPublic, value => { if (!access.processing) access.is_public = value; });
const activeTab = ref('users');
const query = ref('');
const people = ref<VaultUser[]>([]);
const selected = ref<VaultUser | null>(null);
const active = ref(-1);
const state = ref('idle');
const listId = useId();
const canSubmit = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email));

watch([query, activeTab], ([value, tab], _, onCleanup) => {
    form.email = value.trim();
    form.clearErrors();
    people.value = [];
    active.value = -1;
    state.value = 'idle';
    if (tab !== 'inviteUser' || selected.value?.email === value) return;
    selected.value = null;
    if (value.trim().length < 2) return;
    const controller = new AbortController();
    state.value = 'loading';
    const timer = setTimeout(async () => {
        try {
            const response = await fetch(
                index.url({ vault: props.vaultId }, { query: { q: value.trim() } }),
                {
                    signal: controller.signal,
                    headers: { Accept: 'application/json' },
                },
            );
            if (!response.ok) throw new Error();
            const payload = await response.json();
            if (controller.signal.aborted) return;
            people.value = payload.data;
            state.value = people.value.length ? 'ready' : 'empty';
        } catch {
            if (!controller.signal.aborted) state.value = 'error';
        }
    }, 250);
    onCleanup(() => {
        clearTimeout(timer);
        controller.abort();
    });
});

function choose(person: VaultUser) {
    selected.value = person;
    query.value = person.email;
    form.email = person.email;
    people.value = [];
    active.value = -1;
}

function navigate(event: KeyboardEvent) {
    if (!people.value.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        active.value =
            active.value < 0
                ? step === 1
                    ? 0
                    : people.value.length - 1
                : (active.value + step + people.value.length) % people.value.length;
        nextTick(() =>
            document
                .getElementById(`${listId}-${active.value}`)
                ?.scrollIntoView({ block: 'nearest' }),
        );
    } else if (event.key === 'Enter' && active.value >= 0) {
        event.preventDefault();
        choose(people.value[active.value]);
    }
}

const url = store.url({ vault: props.vaultId });

const handleSubmit = () => {
    if (!canSubmit.value || form.processing) return;
    form.post<{ data: VaultCollaborator }>(url, {
        onSuccess: payload => {
            form.reset();
            query.value = '';
            selected.value = null;
            activeTab.value = 'users';
            vaultStore.addCollaborator(payload.data);
        },
    });
};

const deleteCollaborator = (userId: number) => {
    openModal(RequestConfirmationModal, {
        title: 'Delete collaborator',
        url: destroy.url({
            vault: props.vaultId,
            user: userId,
        }),
        method: 'delete',
        content: 'Are you sure you want to delete this collaborator?',
        successMessage: 'Collaborator deleted',
        onSuccess: () => {
            vaultStore.removeCollaborator(userId);
        },
    });
};
</script>

<template>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span id="vault-access-label" class="text-sm font-medium">Access</span>
        <DropdownMenu>
            <DropdownMenuTrigger as-child>
                <Button id="vault-access" variant="outline" class="h-11 min-w-36 justify-between px-3"
                    aria-labelledby="vault-access-label" :disabled="access.processing" :aria-busy="access.processing">
                    {{ access.is_public ? 'Public' : 'Restricted' }}
                    <ChevronDown class="text-muted-foreground size-4" aria-hidden="true" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" :side-offset="4" class="w-36">
                <DropdownMenuRadioGroup :model-value="access.is_public ? 'public' : 'restricted'" @update:model-value="changeAccess">
                    <DropdownMenuRadioItem value="restricted" :disabled="access.processing">Restricted</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="public" :disabled="access.processing">Public</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
        <p class="text-muted-foreground w-full text-xs">{{ access.is_public ? 'Everyone signed into Docs can read and edit.' : 'Only people added below have access.' }}</p>
        <p v-if="accessError" role="alert" class="text-destructive w-full text-sm">{{ accessError }}</p>
    </div>
    <section class="mb-4 flex flex-col gap-2" aria-label="Public link">
        <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-medium">Public link</span>
            <Button v-if="!vaultStore.shareUrl" variant="outline" :disabled="link.processing" :aria-busy="link.processing" @click="changeLink(true)">Create link</Button>
            <Button v-else variant="ghost" size="icon" :disabled="link.processing" :aria-busy="link.processing" aria-label="Disable public link" title="Disable public link" @click="changeLink(false)"><Unlink class="size-4" /></Button>
        </div>
        <p class="text-muted-foreground text-xs">Anyone with the link can read this vault.</p>
        <div v-if="vaultStore.shareUrl" class="flex min-w-0 items-center gap-1">
            <Input :value="vaultStore.shareUrl" readonly aria-label="Public link URL" class="min-w-0 flex-1 text-xs" @focus="($event.target as HTMLInputElement).select()" />
            <Button variant="ghost" size="icon" class="shrink-0" :aria-label="copied ? 'Link copied' : 'Copy public link'" :title="copied ? 'Copied' : 'Copy link'" @click="copyLink"><Check v-if="copied" class="size-4" /><Copy v-else class="size-4" /></Button>
            <a :href="vaultStore.shareUrl" target="_blank" rel="noopener noreferrer" :class="buttonVariants({ variant: 'ghost', size: 'icon' })" aria-label="Open public link" title="Open link"><ExternalLink class="size-4" /></a>
        </div>
        <p v-if="linkError" role="alert" class="text-destructive text-sm">{{ linkError }}</p>
    </section>
    <TabsRoot v-model="activeTab">
        <TabsList class="bg-muted flex gap-1 rounded-lg p-1" aria-label="Sharing">
            <TabsTrigger
                value="users"
                class="data-[state=active]:bg-background focus-visible:ring-ring min-h-10 flex-1 whitespace-nowrap rounded-md px-2 py-2 text-xs focus-visible:ring-2 sm:px-3 sm:text-sm"
            >
                People
            </TabsTrigger>
            <TabsTrigger
                value="inviteUser"
                class="data-[state=active]:bg-background focus-visible:ring-ring min-h-10 flex-1 whitespace-nowrap rounded-md px-2 py-2 text-xs focus-visible:ring-2 sm:px-3 sm:text-sm"
            >
                Add collaborator
            </TabsTrigger>
        </TabsList>
        <TabsContent value="users">
            <ul class="mt-3 divide-y" aria-label="People with access">
                <li class="flex min-h-18 items-center justify-between gap-4 py-4">
                    <div class="min-w-0">
                        <p class="break-words text-sm font-medium">{{ vaultStore.user?.name }}</p>
                        <p
                            class="text-muted-foreground mt-1 truncate text-xs"
                            :title="vaultStore.user?.email"
                        >
                            {{ vaultStore.user?.email }}
                        </p>
                    </div>
                    <span class="text-muted-foreground shrink-0 text-xs">Owner</span>
                </li>
                <li
                    v-for="collaborator in vaultStore.collaborators"
                    :key="collaborator.id"
                    class="flex min-h-18 items-center justify-between gap-4 py-4"
                >
                    <div class="min-w-0">
                        <p class="break-words text-sm font-medium">{{ collaborator.name }}</p>
                        <p
                            class="text-muted-foreground mt-1 truncate text-xs"
                            :title="collaborator.email"
                        >
                            {{ collaborator.email }}
                        </p>
                    </div>
                    <Button
                        v-if="
                            page.props.app?.user?.id === vaultStore.user?.id ||
                            page.props.app?.user?.id === collaborator.id
                        "
                        variant="ghost"
                        size="icon"
                        class="size-11 shrink-0"
                        :aria-label="`Remove ${collaborator.name}`"
                        @click="deleteCollaborator(collaborator.id)"
                    >
                        <Trash class="h-4 w-4" />
                    </Button>
                </li>
            </ul>
        </TabsContent>
        <TabsContent value="inviteUser">
            <div class="pt-4">
                <form
                    class="flex flex-col gap-6 inert:pointer-events-none"
                    autocomplete="off"
                    novalidate
                    :inert="form.processing"
                    @submit.prevent="handleSubmit"
                >
                    <div>
                        <div
                            class="bg-muted/40 focus-within:ring-ring/40 flex items-center gap-2 rounded-lg px-3 focus-within:ring-1 focus-within:ring-inset"
                        >
                            <Search
                                class="text-muted-foreground size-4 shrink-0"
                                aria-hidden="true"
                            />
                            <Input
                                :value="query"
                                @input="query = ($event.target as HTMLInputElement).value"
                                role="combobox"
                                aria-label="Find people"
                                aria-autocomplete="list"
                                :aria-expanded="people.length > 0"
                                :aria-controls="listId"
                                :aria-activedescendant="
                                    active >= 0 ? `${listId}-${active}` : undefined
                                "
                                :aria-invalid="Boolean(form.errors.email)"
                                :aria-describedby="
                                    form.errors.email ? `${listId}-error` : undefined
                                "
                                placeholder="Name or email…"
                                class="h-12 min-w-0 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-sm"
                                autocomplete="off"
                                maxlength="100"
                                autofocus
                                @keydown="navigate"
                            />
                        </div>
                        <ul
                            v-if="people.length"
                            :id="listId"
                            role="listbox"
                            aria-label="People"
                            class="mt-2 max-h-60 overflow-y-auto rounded-lg border p-1"
                        >
                            <li
                                v-for="(person, i) in people"
                                :id="`${listId}-${i}`"
                                :key="person.id"
                                role="option"
                                :aria-selected="active === i"
                                class="cursor-pointer rounded-md px-3 py-3 text-sm"
                                :class="active === i ? 'bg-accent' : 'hover:bg-accent'"
                                @mousedown.prevent
                                @click="choose(person)"
                            >
                                <p class="break-words font-medium">{{ person.name }}</p>
                                <p class="text-muted-foreground mt-1 truncate text-xs">
                                    {{ person.email }}
                                </p>
                            </li>
                        </ul>
                        <p
                            v-if="state === 'loading'"
                            role="status"
                            class="text-muted-foreground mt-3 text-sm"
                        >
                            Searching…
                        </p>
                        <p
                            v-else-if="state === 'empty'"
                            role="status"
                            class="text-muted-foreground mt-3 text-sm"
                        >
                            No people found
                        </p>
                        <p
                            v-else-if="state === 'error'"
                            role="status"
                            class="text-destructive mt-3 text-sm"
                        >
                            Could not load people. Try again.
                        </p>
                        <p
                            v-if="form.errors.email"
                            :id="`${listId}-error`"
                            role="alert"
                            class="text-destructive mt-3 text-sm"
                        >
                            {{ form.errors.email }}
                        </p>
                    </div>
                    <div class="flex justify-end gap-2 py-1">
                        <Button
                            type="submit"
                            :disabled="!canSubmit || form.processing"
                            :aria-busy="form.processing"
                            >{{ form.processing ? 'Adding…' : 'Add collaborator' }}</Button
                        >
                    </div>
                </form>
            </div>
        </TabsContent>
    </TabsRoot>
</template>
