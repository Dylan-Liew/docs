import { Component, computed, markRaw, ref } from 'vue';

interface ModalEntry {
    id: number;
    trigger: HTMLElement | null;
    component: Component;
    props?: Record<string, unknown>;
}

const modalStack = ref<ModalEntry[]>([]);
let nextId = 0;

export function useModalManager() {
    function openModal(component: Component, props?: Record<string, unknown>) {
        const active = document.activeElement;
        const menuTrigger = active?.closest('[role="menu"]')?.getAttribute('aria-labelledby');
        const trigger = menuTrigger ? document.getElementById(menuTrigger) : active;
        modalStack.value.push({
            id: nextId++,
            trigger: trigger instanceof HTMLElement ? markRaw(trigger) : null,
            component: markRaw(component),
            props,
        });
    }

    function closeModal() {
        modalStack.value.pop();
    }

    const activeModal = computed(() => {
        return modalStack.value.at(-1) ?? null;
    });

    return { modalStack, activeModal, openModal, closeModal };
}
