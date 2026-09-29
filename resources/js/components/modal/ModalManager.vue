<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { useModalManager } from '@/composables/useModalManager';
import { X } from 'lucide-vue-next';
import {
    DialogRoot,
    DialogPortal,
    DialogOverlay,
    DialogContent,
    DialogTitle,
    DialogClose,
} from 'reka-ui';

const { modalStack, closeModal } = useModalManager();
function contentProps(props: Record<string, unknown> = {}) {
    const { title: _title, top: _top, compact: _compact, ...rest } = props;
    return rest;
}
function focusContent(event: Event) {
    const content = event.target as HTMLElement;
    const input = content.querySelector<HTMLElement>('[autofocus]');
    if (input) {
        event.preventDefault();
        input.focus();
    }
}
</script>

<template>
    <DialogRoot
        v-for="modal in modalStack"
        :key="modal.id"
        :open="true"
        @update:open="
            open => {
                if (!open) closeModal();
            }
        "
    >
        <DialogPortal>
            <DialogOverlay
                class="fixed inset-0 z-50"
                :class="modal.props?.compact ? 'bg-black/20' : 'bg-black/50'"
            />
            <DialogContent
                :aria-describedby="undefined"
                :class="[
                    'bg-background text-foreground fixed z-50 flex flex-col rounded-xl border shadow-xl outline-none',
                    modal.props?.compact
                        ? 'top-15 right-0 max-h-[calc(100dvh-3.75rem)] w-full max-w-md overflow-hidden rounded-t-none p-0'
                        : 'left-1/2 max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 gap-5 p-5 sm:p-6',
                    !modal.props?.compact &&
                        (modal.props?.top ? 'top-5' : 'top-1/2 -translate-y-1/2'),
                ]"
                @open-auto-focus="focusContent"
                @close-auto-focus="
                    event => {
                        event.preventDefault();
                        if (modal.trigger?.isConnected) modal.trigger.focus();
                    }
                "
            >
                <div
                    :class="
                        modal.props?.compact
                            ? 'contents'
                            : 'flex items-center justify-between gap-3'
                    "
                >
                    <DialogTitle
                        :class="
                            modal.props?.compact
                                ? 'sr-only'
                                : 'text-base font-semibold tracking-tight'
                        "
                    >
                        {{ modal.props?.title }}
                    </DialogTitle>
                    <DialogClose as-child>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Close"
                            :class="
                                modal.props?.compact
                                    ? 'absolute top-0.5 right-0.5 z-10 size-11 rounded-full text-muted-foreground'
                                    : '-mr-2 -my-2'
                            "
                        >
                            <X class="size-4" aria-hidden="true" />
                        </Button>
                    </DialogClose>
                </div>
                <div class="min-h-0 overflow-y-auto">
                    <component
                        :is="modal.component"
                        v-bind="contentProps(modal.props)"
                        @close="closeModal"
                    />
                </div>
            </DialogContent>
        </DialogPortal>
    </DialogRoot>
</template>
