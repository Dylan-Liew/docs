import assert from 'node:assert/strict';

export async function navigation({ browser, base, jwt, dir }) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: true, extraHTTPHeaders: { 'Cf-Access-Jwt-Assertion': jwt('alex@example.test') } });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.goto(base);
        const request = (path, method, data) => page.evaluate(async ({ path, method, data }) => {
            const token = document.cookie.split('; ').find(v => v.startsWith('XSRF-TOKEN='))?.slice(11);
            const response = await fetch(path, { method, headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(token ?? '') }, body: JSON.stringify(data) });
            if (!response.ok) throw new Error(await response.text());
            return response.json();
        }, { path, method, data });
        const vault = (await request('/vaults', 'POST', { name: 'Navigation' })).data;
        const path = `/vaults/${vault.id}`;
        const create = async (name, parent_id = null) => (await request(`${path}/nodes`, 'POST', { name, parent_id, is_file: true })).data;
        const parent = await create('Project');
        const a = await create('Alpha', parent.id);
        const b = await create('Bravo');
        const c = await create('Charlie');
        await request(`${path}/nodes/${b.id}`, 'PATCH', { content: 'Bravo original' });
        await request(`${path}/nodes/${c.id}`, 'PATCH', { content: 'Charlie original' });
        await page.goto(`${base}${path}?file=${a.id}`);
        await page.locator('.tiptap').waitFor();
        const title = page.getByRole('textbox', { name: 'Document title', exact: true });
        const editor = page.locator('.tiptap');
        const open = name => page.locator('aside').getByTitle(name, { exact: true }).click();
        const ready = async (name, content) => {
            await page.waitForFunction(name => document.querySelector('[aria-label="Document title"]')?.value === name && !document.querySelector('[aria-label="Loading document"]'), name);
            if (content) await page.waitForFunction(content => document.querySelector('.tiptap')?.textContent.includes(content), content);
        };
        const visits = [];
        page.on('request', r => { if (r.headers()['x-inertia']) visits.push(r); });
        await page.evaluate(() => {
            window.navigationProbe = { header: document.querySelector('#app-header'), aside: document.querySelector('aside'), loads: performance.getEntriesByType('navigation').length, overlay: false };
            new MutationObserver(() => { if (document.querySelector('[aria-label="Loading"]')) window.navigationProbe.overlay = true; }).observe(document.body, { childList: true, subtree: true });
        });
        await title.fill('Alpha renamed');
        await editor.fill('Alpha draft saved before switching');
        await open('Bravo');
        await ready('Bravo', 'Bravo original');
        assert.equal(visits.length, 1);
        assert.equal(visits[0].headers()['x-inertia-partial-data'], 'openedFile');
        assert(await page.evaluate(() => window.navigationProbe.header === document.querySelector('#app-header') && window.navigationProbe.aside === document.querySelector('aside')));
        assert.equal(await page.getByRole('button', { name: 'Collapse Project', exact: true }).count(), 1);
        await editor.press('Control+z');
        assert(!(await editor.innerText()).includes('Alpha draft'), 'Undo cannot cross documents');
        await open('Alpha renamed');
        await ready('Alpha renamed', 'Alpha draft saved before switching');
        const count = visits.length;
        await open('Alpha renamed');
        await page.waitForTimeout(150);
        assert.equal(visits.length, count, 'Active document is a no-op');

        // Markdown is serialized after a typing pause; opening the source must flush it first.
        await editor.press('Control+End');
        await page.keyboard.type(' typed just now');
        const mode = async name => {
            await page.getByRole('button', { name: 'More editor options', exact: true }).click();
            await page.getByRole('menuitem', { name, exact: true }).click();
        };
        await mode('Markdown source');
        assert.match(await page.getByRole('textbox', { name: 'Markdown source', exact: true }).inputValue(), /typed just now$/, 'Source view shows unsynced rich-text edits');
        await mode('Rich text editor');

        // A failed save preserves the draft and prevents switching. Retrying flushes it.
        await page.route(`**/nodes/${a.id}`, route => route.fulfill({ status: 503, json: { message: 'Try again' } }));
        await editor.fill('Unsaved draft survives a failure');
        await open('Bravo');
        await page.getByText('The service is temporarily unavailable. Try again shortly.').waitFor();
        assert.equal(await title.inputValue(), 'Alpha renamed');
        assert((await editor.innerText()).includes('Unsaved draft survives a failure'));
        await page.unroute(`**/nodes/${a.id}`);
        await open('Bravo');
        await ready('Bravo');
        await page.goBack();
        await ready('Alpha renamed', 'Unsaved draft survives a failure');
        const historyCount = visits.length;
        await page.goForward();
        await ready('Bravo', 'Bravo original');
        assert.equal(visits.length, historyCount, 'History restores locally, without a second reload');
        assert.equal(await page.getByRole('button', { name: 'Collapse Project', exact: true }).count(), 1);

        // A slow old visit must not win over the next click; sidebar remains usable.
        let release;
        const held = new Promise(resolve => { release = resolve; });
        await page.route(`**${path}?file=${a.id}`, async route => {
            await held;
            await route.continue().catch(() => {});
        });
        const pending = page.waitForRequest(r => r.url().endsWith(`?file=${a.id}`));
        await open('Alpha renamed');
        await pending;
        await page.getByRole('status', { name: 'Loading document', exact: true }).waitFor();
        assert.equal(await page.getByRole('status', { name: 'Loading', exact: true }).count(), 0);
        await open('Charlie');
        release();
        await ready('Charlie', 'Charlie original');
        await page.unroute(`**${path}?file=${a.id}`);
        const beforeClose = visits.length;
        await page.getByTitle('Close file', { exact: true }).click();
        await page.getByText('Recent files', { exact: true }).waitFor();
        assert.equal(visits.length, beforeClose, 'Closing a document needs no request');
        await page.goBack();
        await ready('Charlie', 'Charlie original');

        // Leaf notes stay openable and accept children, but have no empty expander.
        const arrow = name => page.getByRole('button', { name: new RegExp(`^(Expand|Collapse) ${name}$`) });
        assert.equal(await arrow('Bravo').count(), 0);
        assert.equal(await arrow('Charlie').count(), 0);
        assert.equal(await arrow('Alpha renamed').count(), 0);
        await page.getByRole('button', { name: 'Actions for Charlie', exact: true }).click();
        await page.getByRole('button', { name: 'New sub-note', exact: true }).click();
        await page.getByRole('textbox', { name: 'Document name' }).fill('Temporary');
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await ready('Temporary');
        await page.getByRole('button', { name: 'Collapse Charlie', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Actions for Temporary', exact: true }).click();
        await page.getByRole('button', { name: 'Move to…', exact: true }).click();
        const picker = page.getByRole('dialog', { name: 'Move to', exact: true });
        await picker.getByRole('button', { name: 'Open Bravo', exact: true }).click();
        await picker.getByRole('button', { name: 'Move here', exact: true }).click();
        await picker.waitFor({ state: 'hidden' });
        assert.equal(await arrow('Charlie').count(), 0, 'Moving the last child hides its old parent arrow');
        await page.getByRole('button', { name: 'Collapse Bravo', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Actions for Temporary', exact: true }).click();
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        await page.getByRole('dialog', { name: 'Delete file', exact: true }).getByRole('button', { name: 'Delete', exact: true }).click();
        await page.getByText('Recent files', { exact: true }).waitFor();
        assert.equal(await arrow('Bravo').count(), 0, 'Deleting the last child hides its parent arrow');
        assert.equal(await page.locator('aside').getByText('No sub-notes', { exact: true }).count(), 0, 'Empty branches do not leave placeholder rows');
        await open('Charlie');
        await ready('Charlie', 'Charlie original');

        // Branch arrows still expand by keyboard and touch.
        const collapse = page.getByRole('button', { name: 'Collapse Project', exact: true });
        assert.equal(await collapse.locator('svg').count(), 1);
        await collapse.focus();
        await page.keyboard.press('Enter');
        await page.getByRole('button', { name: 'Expand Project', exact: true }).waitFor();
        await page.keyboard.press('Enter');
        await page.getByRole('button', { name: 'Collapse Project', exact: true }).waitFor();
        await page.screenshot({ path: new URL('navigation-1440.png', dir).pathname });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.getByRole('button', { name: 'Toggle document tree' }).tap();
        await page.getByRole('button', { name: 'Collapse Project', exact: true }).tap();
        await page.getByRole('button', { name: 'Expand Project', exact: true }).tap();
        await page.screenshot({ path: new URL('navigation-390.png', dir).pathname });
        await page.locator('aside').getByTitle('Alpha renamed', { exact: true }).tap();
        await ready('Alpha renamed', 'Unsaved draft survives a failure');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.equal(await page.evaluate(() => window.navigationProbe.overlay), false);
        assert.equal(await page.evaluate(() => performance.getEntriesByType('navigation').length), 1);
        assert.deepEqual(errors, []);
        return 'Vault SPA navigation: persistent shell, partial requests, save-before-switch, failure/retry, isolated undo, latest-click wins, local history/close; branch-only arrows update on create/move/delete and support keyboard/touch';
    } catch (error) {
        await page.screenshot({ path: new URL('navigation-failure.png', dir).pathname }).catch(() => {});
        throw error;
    } finally {
        await context.close();
    }
}
