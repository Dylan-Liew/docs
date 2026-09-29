<script setup lang="ts">
import { computed, useId } from 'vue';

defineOptions({ inheritAttrs: false });

const model = defineModel<string | number | null>({
    default: null,
});

const props = defineProps<{
    name: string;
    type: string;
    label?: string;
    error?: string;
}>();

const hasError = computed(() => !!props.error);
const errorId = `${props.name}-${useId()}-error`;
</script>

<template>
    <label class="flex flex-col gap-2 text-sm font-medium">
        <span v-if="label">
            {{ label }}
            <span v-if="'required' in $attrs" class="text-error-500 opacity-75" aria-hidden="true">
                *
            </span>
        </span>
        <input
            v-bind="$attrs"
            v-model="model"
            :name="name"
            :type="type"
            :class="[
                'bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring block w-full rounded-md border px-3 py-2 text-base sm:text-sm focus-visible:ring-2 focus-visible:outline-none',
                error
                    ? 'border-error-500 focus:border-error-700 dark:border-error-500 dark:focus:border-error-700'
                    : 'border-input focus:border-ring',
            ]"
            :aria-invalid="hasError"
            :aria-describedby="hasError ? errorId : undefined"
        />

        <p v-if="hasError" :id="errorId" class="text-error-500 text-sm">
            {{ error }}
        </p>
    </label>
</template>
