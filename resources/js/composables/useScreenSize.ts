import { onMounted, onUnmounted, ref } from 'vue';

export function useScreenSize(breakpoint = 1024) {
    const mediaQuery = globalThis.matchMedia(`(min-width: ${breakpoint}px)`);

    const isSmallScreen = ref(!mediaQuery.matches);

    function handleChange(e: MediaQueryListEvent) {
        isSmallScreen.value = !e.matches;
    }

    onMounted(() => {
        isSmallScreen.value = !mediaQuery.matches;

        mediaQuery.addEventListener('change', handleChange);
    });

    onUnmounted(() => {
        mediaQuery.removeEventListener('change', handleChange);
    });

    return {
        isSmallScreen,
    };
}
