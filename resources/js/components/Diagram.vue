<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { Code2, Maximize2, Minus, Plus, Scan, X } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { diagram } from '@/services/diagram';

const props = defineProps<{ source: string }>();
const emit = defineEmits<{ code: [] }>();
const id = `diagram-${crypto.randomUUID()}`;
const result = computed(() => {
    try { return { value: diagram(props.source), error: '' }; }
    catch (error) { return { value: undefined, error: error instanceof Error ? error.message : 'Unable to render diagram.' }; }
});
const model = computed(() => result.value.value);
const view = ref<[number, number, number, number]>([0, 0, 1, 1]);
const expanded = ref(false);
const modal = ref<HTMLDialogElement>();
const stage = ref<HTMLDivElement>();
const svg = ref<SVGSVGElement>();
const expandButton = ref<InstanceType<typeof Button>>();
const pointers = new Map<number, { x: number; y: number }>();
let inlineView: typeof view.value | undefined;
const tones = ['external', 'backend', 'security'];
function reset() { if (model.value) view.value = [...model.value.view]; }
watch(model, () => { pointers.clear(); inlineView = undefined; reset(); }, { immediate: true });
function zoom(factor: number, cx = view.value[0] + view.value[2] / 2, cy = view.value[1] + view.value[3] / 2) {
    if (!model.value) return;
    const [x, y, w, h] = view.value;
    const scale = Math.min(12, Math.max(0.5, model.value.view[2] / w * factor));
    const ratio = (model.value.view[2] / scale) / w;
    view.value = [cx - (cx - x) * ratio, cy - (cy - y) * ratio, w * ratio, h * ratio];
}
function coordinate(x: number, y: number) {
    const matrix = svg.value?.getScreenCTM();
    return matrix ? new DOMPoint(x, y).matrixTransform(matrix.inverse()) : new DOMPoint();
}
function wheel(event: WheelEvent) {
    // Inline diagrams leave ordinary document scrolling alone.
    if (!expanded.value && !event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const p = coordinate(event.clientX, event.clientY);
    zoom(Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * 0.006), p.x, p.y);
}
function down(event: PointerEvent) {
    if (event.button !== 0) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    stage.value?.setPointerCapture(event.pointerId);
    stage.value?.focus({ preventScroll: true });
}
function move(event: PointerEvent) {
    if (!pointers.has(event.pointerId)) return;
    const before = [...pointers.values()];
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const after = [...pointers.values()];
    const center = (points: { x: number; y: number }[]) => ({ x: points.reduce((n, p) => n + p.x, 0) / points.length, y: points.reduce((n, p) => n + p.y, 0) / points.length });
    const prev = center(before), next = center(after);
    const a = coordinate(prev.x, prev.y), b = coordinate(next.x, next.y);
    if (before.length === 2) {
        const distance = (p: typeof before) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        if (distance(before) > 2) zoom(distance(after) / distance(before), a.x, a.y);
    }
    view.value = [view.value[0] + a.x - b.x, view.value[1] + a.y - b.y, view.value[2], view.value[3]];
}
function up(event: PointerEvent) { pointers.delete(event.pointerId); }
function key(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (['+', '=', '-', '0', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === '+' || event.key === '=') zoom(1.25);
        else if (event.key === '-') zoom(0.8);
        else if (event.key === '0') reset();
        else {
            const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]!;
            view.value = [view.value[0] + direction[0] * view.value[2] / 10, view.value[1] + direction[1] * view.value[3] / 10, view.value[2], view.value[3]];
        }
    }
}
async function open() {
    pointers.clear();
    inlineView = [...view.value];
    expanded.value = true;
    await nextTick();
    modal.value?.showModal();
    // On a phone, open at readable source scale rather than shrinking text to
    // a few pixels. Reset still provides the whole-diagram overview.
    const scale = svg.value?.getScreenCTM()?.a;
    if (scale && scale < 1) zoom(1 / scale);
}
async function close() {
    pointers.clear();
    modal.value?.close();
    expanded.value = false;
    if (inlineView) view.value = inlineView;
    await nextTick();
    (expandButton.value?.$el as HTMLButtonElement | undefined)?.focus({ preventScroll: true });
}
onBeforeUnmount(() => { pointers.clear(); modal.value?.close(); });
function length(text: string, width: number, size: number) {
    return Array.from(text).length * size * 0.6 > width - 16 ? Math.max(1, width - 16) : undefined;
}
</script>

<template>
    <div class="diagram not-prose" contenteditable="false">
        <dialog ref="modal" class="diagram-modal" :aria-label="model?.title || 'Diagram'" @cancel.prevent="close" @click="event => { if (event.target === modal) close(); }" />
        <Teleport :to="modal || 'body'" :disabled="!expanded">
            <section class="diagram-panel" :class="{ expanded }" :aria-label="model?.title || 'Diagram'">
                <div class="diagram-bar">
                    <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground">{{ model?.title || 'Diagram' }}</span>
                    <Button v-if="!expanded" variant="ghost" size="icon" aria-label="Show diagram code" title="Edit JSON" @click="emit('code')"><Code2 class="size-4" /></Button>
                    <template v-if="model">
                        <Button variant="ghost" size="icon" aria-label="Zoom out" title="Zoom out (−)" @click="zoom(0.8)"><Minus class="size-4" /></Button>
                        <Button variant="ghost" size="icon" aria-label="Zoom in" title="Zoom in (+)" @click="zoom(1.25)"><Plus class="size-4" /></Button>
                        <Button variant="ghost" size="icon" aria-label="Reset view" title="Reset view (0)" @click="reset"><Scan class="size-4" /></Button>
                    </template>
                    <Button v-if="!expanded && model" ref="expandButton" variant="ghost" size="icon" aria-label="Expand diagram" title="Expand diagram" @click="open"><Maximize2 class="size-4" /></Button>
                    <Button v-if="expanded" variant="ghost" size="icon" aria-label="Close diagram" title="Close diagram (Esc)" @click="close"><X class="size-4" /></Button>
                </div>
                <p v-if="result.error" role="alert" class="m-0 p-4 text-sm text-muted-foreground">{{ result.error }}</p>
                <div v-else-if="model" ref="stage" class="diagram-stage" tabindex="0" role="region" aria-label="Diagram canvas. Drag to pan; use plus, minus and zero to zoom or reset."
                    @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @lostpointercapture="up" @wheel="wheel" @keydown="key">
                    <svg ref="svg" :viewBox="view.join(' ')" role="img" :aria-labelledby="`${id}-title`" xmlns="http://www.w3.org/2000/svg">
                        <title :id="`${id}-title`">{{ model.title }}</title>
                        <defs>
                            <marker v-for="tone in tones" :id="`${id}-${tone}`" :key="tone" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" :class="`tone-${tone}`"><polygon points="0 0, 10 3.5, 0 7" fill="currentColor" /></marker>
                        </defs>
                        <g v-for="(boundary, i) in model.boundaries" :key="`b${i}`" class="diagram-boundary">
                            <rect :x="boundary.x" :y="boundary.y" :width="boundary.width" :height="boundary.height" rx="10" />
                            <text :x="boundary.x + 10" :y="boundary.y + 16" font-size="10" :textLength="length(boundary.label, boundary.width, 10)" lengthAdjust="spacingAndGlyphs">{{ boundary.label }}</text>
                        </g>
                        <path v-for="(edge, i) in model.edges" :key="`e${i}`" :d="edge.path" :class="`tone-${edge.tone}`" fill="none" stroke="currentColor" stroke-width="1.5" :stroke-dasharray="edge.dashed ? '6 4' : undefined" :marker-end="`url(#${id}-${edge.tone})`" />
                        <g v-for="node in model.nodes" :key="node.id" :class="`diagram-node tone-${node.tone}`">
                            <title>{{ [node.label, node.sublabel, node.tag].filter(Boolean).join(' — ') }}</title>
                            <rect :x="node.x" :y="node.y" :width="node.width" :height="node.height" rx="6" />
                            <text :x="node.x + node.width / 2" :y="node.y + node.height / 2 + (node.sublabel ? -2 : 4)" text-anchor="middle" font-size="12" font-weight="600" :textLength="length(node.label, node.width, 12)" lengthAdjust="spacingAndGlyphs">{{ node.label }}</text>
                            <text v-if="node.sublabel" class="diagram-muted" :x="node.x + node.width / 2" :y="node.y + node.height / 2 + 14" text-anchor="middle" font-size="10" :textLength="length(node.sublabel, node.width, 10)" lengthAdjust="spacingAndGlyphs">{{ node.sublabel }}</text>
                            <text v-if="node.tag" class="diagram-muted" :x="node.x + node.width / 2" :y="node.y + node.height - 6" text-anchor="middle" font-size="8" :textLength="length(node.tag, node.width, 8)" lengthAdjust="spacingAndGlyphs">{{ node.tag }}</text>
                        </g>
                        <g v-for="(edge, i) in model.edges" :key="`l${i}`">
                            <text v-if="edge.label" class="diagram-label" :x="edge.at[0]" :y="edge.at[1]" text-anchor="middle" font-size="10">{{ edge.label }}</text>
                        </g>
                    </svg>
                </div>
            </section>
        </Teleport>
    </div>
</template>

<style scoped>
.diagram { margin-block: 0; min-width: 0; }
.diagram-panel { border: 1px solid var(--border); border-radius: .5rem; overflow: hidden; background: var(--background); color: var(--foreground); font-family: ui-sans-serif, system-ui, sans-serif; }
.diagram-bar { display: flex; align-items: center; gap: 2px; padding: 4px 8px 4px 12px; border-bottom: 1px solid var(--border); }
.diagram-bar button { flex-shrink: 0; height: 36px; width: 36px; }
.diagram-stage { height: clamp(240px, 44vw, 440px); max-height: 60dvh; cursor: grab; touch-action: none; user-select: none; outline-offset: -2px; }
.diagram-stage:active { cursor: grabbing; }
.diagram-stage svg { display: block; width: 100%; height: 100%; max-width: none; }
.diagram-modal { margin: auto; padding: 0; border: 1px solid var(--border); border-radius: .75rem; width: calc(100vw - 24px); max-width: 1440px; height: calc(100dvh - 24px); max-height: 100dvh; background: var(--background); color: var(--foreground); overflow: hidden; }
.diagram-modal::backdrop { background: rgb(0 0 0 / .65); }
.expanded { display: flex; flex-direction: column; height: 100%; border: 0; border-radius: 0; }
.expanded .diagram-stage { flex: 1; min-height: 0; height: auto; max-height: none; }
.tone-external { color: var(--muted-foreground); }
.tone-frontend { color: light-dark(#257257, #76c7a5); }
.tone-backend { color: light-dark(#4265b0, #92aef0); }
.tone-database { color: light-dark(#8160a8, #b89adc); }
.tone-cloud { color: light-dark(#906524, #dbb474); }
.tone-security { color: light-dark(#a55160, #e1a0ad); }
.tone-messagebus { color: light-dark(#397983, #8cc5ce); }
.diagram-panel { color-scheme: light; }
:global(.dark) .diagram-panel { color-scheme: dark; }
.diagram-node rect { fill: var(--background); stroke: currentColor; stroke-width: 1.5; }
.diagram-node text { fill: var(--foreground); }
.diagram-node .diagram-muted, .diagram-boundary text { fill: var(--muted-foreground); }
.diagram-boundary rect { fill: color-mix(in srgb, var(--muted-foreground) 4%, var(--background)); stroke: var(--border); stroke-dasharray: 6 4; }
.diagram-label { fill: var(--muted-foreground); stroke: var(--background); stroke-width: 5px; paint-order: stroke; stroke-linejoin: round; }
@media (max-width: 639px) { .diagram-modal { width: 100vw; height: 100dvh; max-width: 100vw; border-radius: 0; border: 0; } }
</style>
