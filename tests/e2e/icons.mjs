import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const files = {
    '/icon.ico': 'icon.ico',
    '/icon.png': 'icon.png',
    '/touch.png': 'touch.png',
    '/icon-light.svg': 'icon-light.svg',
    '/icon-dark.svg': 'icon-dark.svg',
    '/docs.ico': 'icon.ico',
    '/docs.png': 'icon.png',
    '/docs-touch.png': 'touch.png',
    '/docs-light.svg': 'icon-light.svg',
    '/docs-dark.svg': 'icon-dark.svg',
    '/favicon.ico': 'icon.ico',
    '/favicon.png': 'icon.png',
    '/apple-touch-icon.png': 'touch.png',
    '/apple-touch-icon-precomposed.png': 'apple-touch-icon-precomposed.png',
    '/assets/icon-180x180.png': 'assets/icon-180x180.png',
    '/assets/icon-light.svg': 'icon-light.svg',
    '/assets/icon-dark.svg': 'icon-dark.svg'
};
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const expected = async (file) => hash(await readFile(new URL(`../../public/${file}`, import.meta.url)));

export async function icons({ page }) {
    const links = await page.locator('link[rel="icon"], link[rel="apple-touch-icon"]').evaluateAll(
        (nodes) => nodes.map((node) => node.getAttribute('href'))
    );
    assert.deepEqual(links, ['/touch.png', '/icon.ico', '/icon.png', '/icon-light.svg', '/icon-dark.svg']);
    for (const [path, file] of Object.entries(files)) {
        const response = await page.request.get(new URL(path, page.url()).href);
        assert.equal(response.status(), 200, path);
        assert.match(response.headers()['content-type'], /image\//, path);
        assert.equal(hash(await response.body()), await expected(file), path);
    }
    for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        for (const colorScheme of ['light', 'dark']) {
            await page.emulateMedia({ colorScheme });
            assert.deepEqual(await page.locator('link[rel="icon"][media]').evaluateAll(
                (nodes) => nodes.filter((node) => matchMedia(node.media).matches).map((node) => node.getAttribute('href'))
            ), [`/icon-${colorScheme}.svg`]);
        }
    }
    await page.emulateMedia({ colorScheme: 'light' });
    return ['Short icon URLs and legacy aliases serve unchanged artwork; Chromium phone/desktop links select both themes (not native Safari tab UI)'];
}

// Read-only check of the real Nginx/Cloudflare path, without login credentials.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const base = process.argv[2];
    assert(base, 'Usage: node tests/e2e/icons.mjs https://docs.x44ylan.com');
    const results = [];
    const oldQueries = ['/favicon.ico?v=docs13', '/favicon.png?v=docs13', '/apple-touch-icon.png?v=docs13', '/assets/icon-light.svg?v=docs11', '/assets/icon-dark.svg?v=docs11'];
    for (const path of [...Object.keys(files), ...oldQueries]) {
        const response = await fetch(new URL(path, base), { headers: { Accept: 'text/html' }, redirect: 'manual', signal: AbortSignal.timeout(15000) });
        assert.equal(response.status, 200, path);
        assert.match(response.headers.get('content-type'), /image\//, path);
        assert.equal(hash(Buffer.from(await response.arrayBuffer())), await expected(files[path.split('?')[0]]), path);
        assert.match(response.headers.get('cache-control'), /max-age=300(?:,|$)/, path);
        assert.doesNotMatch(response.headers.get('cache-control'), /immutable/, path);
        results.push({ path, status: response.status, cache: response.headers.get('cache-control'), edge: response.headers.get('cf-cache-status') });
    }
    for (const path of ['/', '/vaults', '/api', '/assets/', '/icon.png/extra', '/touch.png/extra', '/docs.png/extra', '/favicon.ico/extra', '/assets/favicon-32x32.png']) {
        const response = await fetch(new URL(path, base), { headers: { Accept: 'text/html' }, redirect: 'manual', signal: AbortSignal.timeout(15000) });
        assert([302, 403].includes(response.status), `${path}: expected Access gate, got ${response.status}`);
        if (response.status === 302) assert.match(response.headers.get('location'), /^https:\/\/[^/]+\.cloudflareaccess\.com\//, path);
        results.push({ path, status: response.status });
    }
    const dir = new URL('../../artifacts/e2e/', import.meta.url);
    await mkdir(dir, { recursive: true });
    await writeFile(new URL('icons.json', dir), JSON.stringify({ base, checked: new Date().toISOString(), status: 'passed', results }, null, 2));
    console.log(JSON.stringify({ status: 'passed', checks: results.length, report: 'artifacts/e2e/icons.json' }));
}
