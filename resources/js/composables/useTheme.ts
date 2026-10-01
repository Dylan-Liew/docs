import { computed, ref, watchEffect } from 'vue';

type Theme = 'light' | 'dark';

const theme = ref<Theme>('light');
const preferredDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
let savedTheme: string | null = null;
try { savedTheme = localStorage.getItem('theme'); } catch {}
theme.value = savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : (preferredDark ? 'dark' : 'light');

watchEffect(() => {
    if (theme.value === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    const dark = theme.value === 'dark';
    const assetBase = document.documentElement.dataset.assetBase ?? '';
    document.querySelector<HTMLLinkElement>('#favicon')?.setAttribute('href', `${assetBase}/icon-${theme.value}.svg?v=docs15`);
    document.querySelector<HTMLLinkElement>('#favicon-fallback')?.setAttribute('href', `${assetBase}/icon${dark ? '-dark' : ''}.ico?v=docs15`);
    document.querySelector<HTMLLinkElement>('#favicon-png')?.setAttribute('href', `${assetBase}/icon${dark ? '-dark' : ''}.png?v=docs15`);
    try { localStorage.setItem('theme', theme.value); } catch {}
});

export function useTheme() {
    const isDark = computed(() => theme.value === 'dark');

    const toggleTheme = () => {
        theme.value = theme.value === 'light' ? 'dark' : 'light';
    };

    return { theme, isDark, toggleTheme };
}
