import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import inertia from '@inertiajs/vite';
import tailwindcss from "@tailwindcss/vite";
import vue from '@vitejs/plugin-vue';
import { wayfinder } from "@laravel/vite-plugin-wayfinder";
import path from 'node:path';

const editorLibrary =
    /[\\/]node_modules[\\/](@tiptap|prosemirror-[^\\/]+|orderedmap|rope-sequence|w3c-keyname|linkifyjs|lowlight|highlight\.js|devlop|marked|turndown|@guyplusplus)[\\/]/;
// Keep in sync with lazyLanguages in resources/js/services/lowlight.ts.
const lazyGrammar =
    /[\\/]highlight\.js[\\/](?:lib|es)[\\/]languages[\\/](arduino|c|cpp|csharp|go|graphql|ini|java|kotlin|less|lua|makefile|objectivec|perl|php-template|python-repl|r|ruby|rust|scss|swift|vbnet|wasm)\.js$/;

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.ts'],
            refresh: true,
        }),
        vue(),
        inertia({
            ssr: false,
        }),
        wayfinder({
            formVariants: true,
        }),
        tailwindcss(),
    ],
    resolve: {
        alias: {
            '@': path.resolve(import.meta.dirname, 'resources/js'),
        },
    },
    build: {
        rolldownOptions: {
            output: {
                codeSplitting: {
                    // Editor libraries change rarely; a separate chunk stays cached
                    // across app deploys. Lazy grammars keep their own chunks.
                    groups: [
                        {
                            name: 'editor',
                            test: (id) =>
                                editorLibrary.test(id) && !lazyGrammar.test(id),
                        },
                    ],
                },
            },
        },
    },
    server: {
        fs: {
            allow: ['..'],
        },
    },
});
