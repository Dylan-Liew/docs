<script setup lang="ts">
import { destroy, index, store } from '@/actions/App/Http/Controllers/VaultCollaborationController';
import { Button } from '@/components/ui/button';
import Input from '@/components/ui/input/Input.vue';
import { Search } from 'lucide-vue-next';
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from 'reka-ui';
import { useModalManager } from '@/composables/useModalManager';
import { useRequest } from '@/composables/useRequest';
import Trash from '@/icons/Trash.vue';
import { useVaultStore } from '@/stores/vault';
import { VaultCollaborator, VaultUser } from '@/types/vault';
import { usePage } from '@inertiajs/vue3';
import { computed, nextTick, ref, useId, watch } from 'vue';
import RequestConfirmationModal from './RequestConfirmationModal.vue';

const props = defineProps<{
    vaultId: number;
}>();

const vaultStore = useVaultStore();
const page = usePage();
const { openModal } = useModalManager();

const form = useRequest<{ email: string }>({ email: '' });
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
