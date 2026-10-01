<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, interactive-widget=resizes-content">
    <meta name="apple-mobile-web-app-title" content="Docs">
    <link rel="apple-touch-icon" href="/touch.png?v=line1" sizes="180x180">
    <link id="favicon-fallback" rel="icon" type="image/x-icon" href="/icon.ico?v=line1" sizes="16x16 32x32 48x48">
    <link id="favicon-png" rel="icon" type="image/png" href="/icon.png?v=line1" sizes="32x32">
    <link id="favicon" rel="icon" type="image/svg+xml" href="/icon-light.svg?v=line1" sizes="any">
    <script>
    (function () {
        let theme;
        try { theme = localStorage.getItem('theme'); } catch {}
        const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

        const dark = theme === 'dark' || (theme !== 'light' && prefersDarkMode);
        if (dark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        document.getElementById('favicon').href = `/icon-${dark ? 'dark' : 'light'}.svg?v=line1`;
        document.getElementById('favicon-fallback').href = `/icon${dark ? '-dark' : ''}.ico?v=line1`;
        document.getElementById('favicon-png').href = `/icon${dark ? '-dark' : ''}.png?v=line1`;
    })();
    </script>
    @vite(['resources/css/app.css', 'resources/js/app.ts'])
    <x-inertia::head>
        <title>Docs</title>
    </x-inertia::head>
</head>
<body>
    <x-inertia::app />
</body>
</html>
