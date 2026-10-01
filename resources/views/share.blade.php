<!DOCTYPE html>
<html lang="en" data-asset-base="/share">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <meta name="referrer" content="no-referrer">
    <meta name="apple-mobile-web-app-title" content="Docs">
    <link rel="apple-touch-icon" href="/share/touch.png" sizes="180x180">
    <link id="favicon" rel="icon" type="image/svg+xml" href="/share/icon-light.svg">
    <script>
    (function () {
        let theme;
        try { theme = localStorage.getItem('theme'); } catch {}
        const dark = theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.classList.toggle('dark', dark);
        document.getElementById('favicon').href = `/share/icon-${dark ? 'dark' : 'light'}.svg`;
    })();
    </script>
    @vite(['resources/css/app.css', 'resources/js/share.ts'], 'share/build')
    <title>{{ $data['selected']['name'] ?? $data['name'] ?? 'Docs' }}</title>
</head>
<body>
    <script id="share-data" type="application/json">{!! json_encode($data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR) !!}</script>
    <div id="app"></div>
</body>
</html>
