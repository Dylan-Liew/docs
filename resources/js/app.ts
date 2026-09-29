import { createInertiaApp } from '@inertiajs/vue3';
import { createPinia } from 'pinia';
import './bootstrap';

createInertiaApp({
    pages: './pages',
    title: title => title || 'Docs',
    withApp(app) {
        app.use(createPinia());
    },
});
