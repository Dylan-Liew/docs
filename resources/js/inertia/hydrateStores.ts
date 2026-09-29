import { useUserStore } from '@/stores/user';
import { AppPageProps } from '@/types';

export function hydrateStoresFromPageProps(props: AppPageProps) {
    const app = props.app;

    if (app?.user !== undefined) {
        useUserStore().setUser(app.user);
    }
}
