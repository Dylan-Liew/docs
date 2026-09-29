<script setup lang="ts">
import { cn } from '@/lib/utils';
import { DropdownMenuSeparator, type DropdownMenuSeparatorProps, useForwardProps } from 'reka-ui';
import { type HTMLAttributes, computed } from 'vue';

const props = defineProps<DropdownMenuSeparatorProps & { class?: HTMLAttributes['class'] }>();

const delegatedProps = computed(() => {
    const { class: _, ...delegate } = props;
    return delegate;
});

const forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
    <DropdownMenuSeparator
        v-bind="forwardedProps"
        :class="cn('bg-border -mx-1 my-1 h-px', props.class)"
    />
</template>
