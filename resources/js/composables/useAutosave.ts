import { onBeforeUnmount } from 'vue';

type Save = { flush: () => Promise<boolean>; pending: () => boolean };
const saves = new Set<Save>();

export async function flushEdits(): Promise<boolean> {
    return (await Promise.all([...saves].map(save => save.flush()))).every(Boolean);
}

window.addEventListener('beforeunload', event => {
    if ([...saves].some(save => save.pending())) event.preventDefault();
});

// Serialize each field's writes and flush its debounce before changing notes.
interface AutosaveSource {
    // Produce any value still held by the editor before saving.
    flush?: () => void;
    pending?: () => boolean;
}

export function useAutosave(save: (value: string) => Promise<boolean>, source: AutosaveSource = {}) {
    let queued: string | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running: Promise<boolean> | undefined;

    function flush(): Promise<boolean> {
        source.flush?.();
        clearTimeout(timer);
        if (running) return running;
        running = (async () => {
            while (queued !== undefined) {
                const value = queued;
                queued = undefined;
                if (!await save(value).catch(() => false)) {
                    queued ??= value;
                    return false;
                }
            }
            return true;
        })().finally(() => { running = undefined; });
        return running;
    }

    const entry = { flush, pending: () => queued !== undefined || !!running || !!source.pending?.() };
    saves.add(entry);
    onBeforeUnmount(() => {
        void flush().finally(() => saves.delete(entry));
    });

    function queue(value: string) {
        queued = value;
        clearTimeout(timer);
        timer = setTimeout(() => void flush(), 1000);
    }

    return Object.assign(queue, { pending: entry.pending });
}
