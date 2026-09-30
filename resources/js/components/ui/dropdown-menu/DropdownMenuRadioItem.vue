<script setup lang="ts">
import { cn } from '@/lib/utils';
import { Check } from 'lucide-vue-next';
import {
    DropdownMenuItemIndicator,
    DropdownMenuRadioItem,
    type DropdownMenuRadioItemEmits,
    type DropdownMenuRadioItemProps,
    useForwardPropsEmits,
} from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

const props = defineProps<DropdownMenuRadioItemProps & { class?: HTMLAttributes['class'] }>();
const emits = defineEmits<DropdownMenuRadioItemEmits>();
const delegatedProps = computed(() => {
    const { class: _, ...delegate } = props;
    return delegate;
});
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
    <DropdownMenuRadioItem
        v-bind="forwarded"
        :class="cn('focus:bg-accent focus:text-accent-foreground relative flex min-h-11 cursor-default items-center rounded-sm py-1.5 pr-3 pl-8 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50', props.class)"
    >
        <span class="absolute left-2 flex size-4 items-center justify-center">
            <DropdownMenuItemIndicator>
                <Check class="size-4" aria-hidden="true" />
            </DropdownMenuItemIndicator>
        </span>
        <slot />
    </DropdownMenuRadioItem>
</template>
