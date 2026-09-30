import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const files = {
    '/icon.ico': 'icon.ico',
    '/icon.png': 'icon.png',
    '/icon-dark.png': 'icon-dark.png',
    '/icon-dark.ico': 'icon-dark.ico',
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
    for (const [path, file] of Object.entries(files)) {
        const response = await page.request.get(new URL(path, page.url()).href);
        assert.equal(response.status(), 200, path);
        assert.match(response.headers()['content-type'], /image\//, path);
        assert.equal(hash(await response.body()), await expected(file), path);
    }
    // Failure cases: fixed raster fallbacks, OS/app mismatch, stale URLs on
    // reload, missing initial selection and lost alpha at phone/desktop sizes.
    const checks = [];
    for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        for (const colorScheme of ['light', 'dark']) {
            await page.emulateMedia({ colorScheme });
            for (const theme of ['light', 'dark']) {
                await page.evaluate(() => localStorage.removeItem('theme'));
                await page.reload();
                await page.getByRole('button', { name: 'User menu', exact: true }).click();
                if (theme !== colorScheme) {
                    await page.getByRole('menuitem', { name: `${theme === 'dark' ? 'Dark' : 'Light'} mode`, exact: true }).click();
                } else {
                    await page.keyboard.press('Escape');
                }
                for (const reload of [false, true]) {
                    if (reload) await page.reload();
                    const suffix = theme === 'dark' ? '-dark' : '';
                    const expectedLinks = [`/icon${suffix}.ico?v=docs15`, `/icon${suffix}.png?v=docs15`, `/icon-${theme}.svg?v=docs15`];
                    await page.waitForFunction((hrefs) => JSON.stringify([...document.querySelectorAll('link[rel="icon"]')].map(n => n.getAttribute('href'))) === JSON.stringify(hrefs), expectedLinks);
                    for (const href of expectedLinks) {
                        const pixels = await page.evaluate(async (href) => {
                            const image = new Image();
                            image.src = href;
                            await image.decode();
                            const canvas = document.createElement('canvas');
                            canvas.width = canvas.height = 32;
                            const context = canvas.getContext('2d');
                            context.drawImage(image, 0, 0, 32, 32);
                            const data = context.getImageData(0, 0, 32, 32).data;
                            let total = 0, count = 0;
                            for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 100) { total += data[i]; count++; }
                            return { corner: data[3], color: total / count, count };
                        }, href);
                        assert.equal(pixels.corner, 0, `Transparent background: ${href}`);
                        assert(pixels.count > 40, `Visible mark: ${href}`);
                        assert(theme === 'dark' ? pixels.color > 230 : pixels.color < 45, `Correct artwork: ${href}`);
                    }
                    checks.push({ width, colorScheme, theme, reload });
                }
            }
        }
    }
    await page.evaluate(() => localStorage.setItem('theme', 'light'));
    await page.emulateMedia({ colorScheme: 'light' });
    await page.reload();
    await writeFile(new URL('../../artifacts/e2e/icon-themes.json', import.meta.url), JSON.stringify({ status: 'passed', checks }, null, 2));
    return ['Transparent SVG/PNG/ICO icons follow the app theme, including OS mismatch and reload at phone/desktop widths'];
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
