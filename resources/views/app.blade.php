<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, interactive-widget=resizes-content">
    <meta name="apple-mobile-web-app-title" content="Docs">
    <link rel="apple-touch-icon" href="/touch.png" sizes="180x180">
    <link rel="icon" type="image/x-icon" href="/icon.ico" sizes="16x16 32x32 48x48">
    <link rel="icon" type="image/png" href="/icon.png" sizes="32x32">
    <link rel="icon" type="image/svg+xml" href="/icon-light.svg" media="(prefers-color-scheme: light)">
    <link rel="icon" type="image/svg+xml" href="/icon-dark.svg" media="(prefers-color-scheme: dark)">
    <script>
    (function () {
        const theme = localStorage.getItem('theme');
        const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (theme === 'dark' || (!theme && prefersDarkMode)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
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
