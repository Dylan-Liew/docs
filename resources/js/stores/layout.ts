import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useLayoutStore = defineStore('layout', () => {
    const isAppLoading = ref<boolean>(false);
    const isFileLoading = ref(false);
    const isTreeViewLoading = ref<boolean>(false);
    const isVaultNodeUpdating = ref<boolean>(false);
    const showToggleContentWidthButton = ref<boolean>(false);
    const isContentWidthFull = ref<boolean>(
        localStorage.getItem('contentWidthFull') === 'true' || false
    );

    const isLeftPanelOpen = ref<boolean>(false);

    const leftPanelPreferredOpen = ref<boolean>(
        localStorage.getItem('leftPanelPreferredOpen')
            ? localStorage.getItem('leftPanelPreferredOpen') === 'true'
            : true
    );

    function setAppLoading(value: boolean) {
        isAppLoading.value = value;
    }

    function setTreeViewLoading(value: boolean) {
        isTreeViewLoading.value = value;
    }

    function setVaultNodeUpdating(value: boolean) {
        isVaultNodeUpdating.value = value;
    }

    function setShowToggleContentWidthButton(value: boolean) {
        showToggleContentWidthButton.value = value;
    }

    function toggleContentWidth() {
        isContentWidthFull.value = !isContentWidthFull.value;
        localStorage.setItem('contentWidthFull', isContentWidthFull.value.toString());
    }

    function toggleLeftPanel(isSmallScreen: boolean) {
        if (!isSmallScreen) {
            leftPanelPreferredOpen.value = !leftPanelPreferredOpen.value;
            localStorage.setItem('leftPanelPreferredOpen', leftPanelPreferredOpen.value.toString());
        }

        isLeftPanelOpen.value = !isLeftPanelOpen.value;
    }

    function closePanels() {
        isLeftPanelOpen.value = false;
    }

    function syncPanelsWithScreen(isSmallScreen: boolean) {
        if (isSmallScreen) {
            closePanels();
        } else {
            isLeftPanelOpen.value = leftPanelPreferredOpen.value;
        }
    }

    return {
        isAppLoading,
        isFileLoading,
        isTreeViewLoading,
        isVaultNodeUpdating,
        isContentWidthFull,
        showToggleContentWidthButton,
        isLeftPanelOpen,
        setAppLoading,
        setTreeViewLoading,
        setVaultNodeUpdating,
        setShowToggleContentWidthButton,
        toggleContentWidth,
        toggleLeftPanel,
        closePanels,
        syncPanelsWithScreen,
    };
});
