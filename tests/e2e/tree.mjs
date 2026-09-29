import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

export async function tree({ browser, base, jwt, dir }) {
    const context = await browser.newContext({ hasTouch: true, viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { 'Cf-Access-Jwt-Assertion': jwt('alex@example.test') } });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.goto(base);
        async function request(path, method = 'GET', data) {
            return page.evaluate(async ({ path, method, data }) => {
                const token = document.cookie.split('; ').find(v => v.startsWith('XSRF-TOKEN='))?.slice(11);
                const response = await fetch(path, { method, headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(token ?? '') }, body: data === undefined ? undefined : JSON.stringify(data) });
                return { status: response.status, body: await response.json() };
            }, { path, method, data });
        }
        const vault = (await request('/vaults', 'POST', { name: 'Nested notes' })).body.data;
        const path = `/vaults/${vault.id}`;
        const create = async (name, parent_id = null, is_file = true) => {
            const result = await request(`${path}/nodes`, 'POST', { name, parent_id, is_file });
            assert.equal(result.status, 200, JSON.stringify(result.body));
            return result.body.data;
        };
        const parent = await create('Project');
        const folder = await create('Archive', null, false);
        const sibling = await create('Roadmap');
        const legacyNote = await create('Same name');
        const legacyFolder = await create('Same name', null, false);
        assert.equal(legacyFolder.name, legacyNote.name, 'Existing leaf note/folder names remain compatible');
        assert.equal((await request(`${path}/nodes`, 'POST', { name: 'Blocked', parent_id: legacyNote.id, is_file: true })).status, 422);
        await request(`${path}/nodes/${legacyNote.id}`, 'DELETE');
        await request(`${path}/nodes/${legacyFolder.id}`, 'DELETE');
        await page.goto(`${base}${path}?file=${parent.id}`);
        const node = id => page.locator(`[data-node="${id}"]`);
        const row = id => node(id).locator(':scope > div').first();
        assert.equal(await page.getByRole('button', { name: 'Expand Project', exact: true }).count(), 0, 'A new leaf has no arrow');
        assert.equal(await page.getByRole('button', { name: 'Expand Archive', exact: true }).count(), 0, 'Empty folders have no arrow');
        await page.getByRole('button', { name: 'Actions for Project', exact: true }).click();
        await page.getByRole('button', { name: 'New sub-note', exact: true }).click();
        await page.getByRole('textbox', { name: 'Document name' }).fill('Overview');
        const created = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/nodes'));
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        const child = (await (await created).json()).data;
        assert.equal(child.parent_id, parent.id);
        await page.waitForURL(new RegExp(`file=${child.id}$`));
        const saved = page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().endsWith(`/nodes/${child.id}`));
        await page.locator('.tiptap').fill('Child content survives moves.');
        assert.equal((await saved).status(), 200);
        const grandchild = await create('Details', child.id);
        const alpha = await create('Alpha', parent.id);
        const collision = await create('Project', null, false);
        assert.notEqual(collision.name, parent.name, 'A folder cannot overwrite the child directory of a note');
        await request(`${path}/nodes/${collision.id}`, 'DELETE');
        const reference = await create('Reference');
        await request(`${path}/nodes/${reference.id}`, 'PATCH', { content: '[Child](/Project/Overview.md)\n\n[Details](/Project/Overview/Details.md)' });
        const csrf = async () => decodeURIComponent((await context.cookies()).find(c => c.name === 'XSRF-TOKEN').value);
        const picture = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
        const upload = await context.request.post(`${base}${path}/import`, { headers: { 'X-XSRF-TOKEN': await csrf(), Accept: 'application/json' }, multipart: { parent_id: String(grandchild.id), 'files[]': { name: 'pixel.png', mimeType: 'image/png', buffer: picture } } });
        assert.equal(upload.status(), 200);
        const attachment = (await upload.json()).files[0];
        assert(attachment);
        assert.equal((await request(`${path}/nodes`, 'POST', { name: 'Invalid child', parent_id: attachment.id, is_file: true })).status, 422);
        await page.reload();
        await page.getByRole('button', { name: 'Collapse Project', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Expand Overview', exact: true }).click();
        assert.equal(await page.getByRole('button', { name: 'Expand Alpha', exact: true }).count(), 0);
        assert.equal((await node(alpha.id).getByTitle('Alpha', { exact: true }).boundingBox()).x,
            (await node(child.id).getByTitle('Overview', { exact: true }).boundingBox()).x,
            'Leaf and branch titles remain aligned');
        await node(grandchild.id).waitFor();
        assert(await node(parent.id).getByTitle('Overview', { exact: true }).isVisible());
        assert((await node(alpha.id).boundingBox()).y < (await node(child.id).boundingBox()).y, 'Siblings stay A–Z');

        // A normal native drag nests a note, then makes the destination visible.
        await row(sibling.id).dragTo(row(child.id));
        await page.waitForFunction(({ child, sibling }) => !!document.querySelector(`[data-node="${child}"] [data-node="${sibling}"]`), { child: child.id, sibling: sibling.id });
        assert((await request(`${path}/nodes/${child.id}/children`)).body.children.some(n => n.id === sibling.id));
        const dt = await page.evaluateHandle(() => new DataTransfer());
        await row(parent.id).dispatchEvent('dragstart', { dataTransfer: dt });
        await row(grandchild.id).dispatchEvent('dragover', { dataTransfer: dt });
        assert.equal(await row(grandchild.id).evaluate(el => el.classList.contains('ring-2')), false, 'Descendants never become drop targets');
        await row(parent.id).dispatchEvent('dragend', { dataTransfer: dt });
        assert.equal(await page.getByRole('status').filter({ hasText: 'Drop on a note' }).count(), 0);
        await dt.dispose();

        // Root drop is explicit; dropping on a note never pretends to reorder A–Z siblings.
        const rootMove = page.waitForResponse(r => r.url().endsWith(`/nodes/${sibling.id}/move`) && r.request().method() === 'PATCH');
        const rootData = await page.evaluateHandle(() => new DataTransfer());
        await row(sibling.id).dispatchEvent('dragstart', { dataTransfer: rootData });
        const rootTarget = page.getByText('Move to vault root', { exact: true }).first();
        await rootTarget.dispatchEvent('dragover', { dataTransfer: rootData });
        await rootTarget.dispatchEvent('drop', { dataTransfer: rootData });
        assert.equal((await rootMove).status(), 200);
        await rootData.dispose();
        await page.waitForFunction(id => document.querySelector(`[data-node="${id}"]`)?.parentElement?.closest('[data-node]') === null, sibling.id);

        // Mobile movement does not depend on HTML drag events.
        await page.setViewportSize({ width: 390, height: 844 });
        await page.getByRole('button', { name: 'Toggle document tree' }).click();
        await page.getByRole('button', { name: 'Actions for Roadmap', exact: true }).tap();
        await page.getByRole('button', { name: 'Move to…', exact: true }).tap();
        const picker = page.getByRole('dialog', { name: 'Move to', exact: true });
        await picker.getByRole('button', { name: 'Open Archive' }).waitFor();
        await picker.getByRole('button', { name: 'Open Archive' }).tap();
        await picker.getByText('Archive', { exact: true }).waitFor();
        await page.screenshot({ path: new URL('tree-move-390.png', dir).pathname });
        await page.route(`**/nodes/${sibling.id}/move`, route => route.fulfill({ status: 503, json: { message: 'Try again' } }));
        await picker.getByRole('button', { name: 'Move here', exact: true }).tap();
        await page.getByText('The service is temporarily unavailable. Try again shortly.').waitFor();
        assert(await picker.isVisible(), 'Failed move keeps the picker open');
        await page.unroute(`**/nodes/${sibling.id}/move`);
        await picker.getByRole('button', { name: 'Move here', exact: true }).tap();
        await picker.waitFor({ state: 'hidden' });
        await node(folder.id).getByTitle('Roadmap', { exact: true }).waitFor();
        assert((await request(`${path}/nodes/${folder.id}/children`)).body.children.some(n => n.id === sibling.id));

        // The picker excludes the moving subtree at its root, including unloaded descendants.
        await page.getByRole('button', { name: 'Actions for Project', exact: true }).tap();
        await page.getByRole('button', { name: 'Move to…', exact: true }).tap();
        await picker.getByRole('button', { name: 'Open Archive' }).waitFor();
        assert.equal(await picker.getByRole('button', { name: 'Open Project', exact: true }).count(), 0);
        await page.keyboard.press('Escape');
        await picker.waitFor({ state: 'hidden' });

        for (const width of [320, 390, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            if (!(await page.locator('#vault-tree-scroll-container').isVisible())) await page.getByRole('button', { name: 'Toggle document tree' }).click();
            for (const theme of ['light', 'dark']) {
                await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme);
                assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
                const selected = page.locator('aside button[aria-current="page"]');
                assert.equal(await selected.count(), 1);
                assert.deepEqual(await selected.evaluate(el => ({
                    background: getComputedStyle(el.parentElement).backgroundColor,
                    text: getComputedStyle(el).color,
                })), { background: 'rgb(39, 39, 42)', text: 'rgb(250, 250, 250)' },
                `Selected row matches Graphite at ${width}px in ${theme} mode`);
                if (width < 640) assert((await page.getByRole('button', { name: 'Actions for Project' }).boundingBox()).height >= 44);
                await page.screenshot({ path: new URL(`tree-${width}-${theme}.png`, dir).pathname, animations: 'disabled' });
            }
        }

        assert.equal((await request(`${path}/nodes/${parent.id}/move`, 'PATCH', { parent_id: grandchild.id })).status, 422);
        assert.equal((await request(`${path}/nodes/${parent.id}/move`, 'PATCH', { parent_id: parent.id })).status, 422);
        const foreign = (await request('/vaults', 'POST', { name: 'Other hierarchy' })).body.data;
        const foreignNode = (await request(`/vaults/${foreign.id}/nodes`, 'POST', { name: 'Other', is_file: true })).body.data;
        assert.equal((await request(`${path}/nodes/${parent.id}/move`, 'PATCH', { parent_id: foreignNode.id })).status, 422);
        assert.equal((await request(`${path}/nodes`, 'POST', { name: 'No', is_file: true, parent_id: foreignNode.id })).status, 422);

        // Rename and move a whole branch, then resolve a child through its new path.
        assert.equal((await request(`${path}/nodes/${parent.id}`, 'PATCH', { name: 'Renamed' })).status, 200);
        assert.equal((await request(`${path}/nodes/${parent.id}/move`, 'PATCH', { parent_id: folder.id })).status, 200);
        const links = (await request(`${path}/nodes`)).body.children.find(n => n.id === reference.id).content;
        assert(links.includes('/Archive/Renamed/Overview.md'));
        assert(links.includes('/Archive/Renamed/Overview/Details.md'));
        const movedImage = (await request(`${path}/nodes/${grandchild.id}/children`)).body.children.find(n => n.id === attachment.id);
        const imageResponse = await context.request.get(`${base}${movedImage.url}`);
        assert.equal(imageResponse.status(), 200);
        assert.deepEqual(await imageResponse.body(), picture);
        const rpc = async (name, args) => {
            const response = await context.request.post(`${base}/mcp`, { headers: { Accept: 'application/json, text/event-stream' }, data: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } } });
            assert.equal(response.status(), 200);
            const result = (await response.json()).result;
            assert(!result.isError, result.content[0].text);
            return JSON.parse(result.content[0].text);
        };
        const agentChild = await rpc('create', { vaultId: vault.id, parentId: child.id, name: 'Agent sub-note', content: 'Nested from MCP.' });
        assert.equal(agentChild.parent_id, child.id);
        assert((await rpc('list', { vaultId: vault.id })).data.some(n => n.id === agentChild.id && n.parent_id === child.id));
        await page.goto(`${base}${path}?file=${parent.id}&path=/Archive/Renamed/Overview.md`);
        await page.locator('.tiptap').getByText('Child content survives moves.', { exact: true }).waitFor();

        const exported = await context.request.get(`${base}${path}/export`);
        assert.equal(exported.status(), 200, await exported.text());
        const archive = await exported.body();
        const archivePath = new URL('tree.zip', dir).pathname;
        await writeFile(archivePath, archive);
        const entries = execFileSync('unzip', ['-Z1', archivePath], { encoding: 'utf8' });
        assert(entries.includes('Archive/Renamed/Overview/Details.md'));
        assert(entries.includes('.docs.json'));
        assert(entries.includes('Archive/Renamed/Overview/Details/pixel.png'));
        const token = (await context.cookies()).find(c => c.name === 'XSRF-TOKEN').value;
        const imported = await context.request.post(`${base}/vaults/import`, { headers: { 'X-XSRF-TOKEN': decodeURIComponent(token), Accept: 'application/json' }, multipart: { file: { name: 'Tree copy.zip', mimeType: 'application/zip', buffer: archive } } });
        assert.equal(imported.status(), 200, await imported.text());
        await page.goto(base);
        await page.getByRole('link', { name: 'Open Tree copy', exact: true }).click();
        await page.getByRole('button', { name: 'Expand Archive', exact: true }).click();
        await page.getByRole('button', { name: 'Expand Renamed', exact: true }).click();
        await page.getByRole('button', { name: 'Expand Overview', exact: true }).click();
        await page.getByTitle('Details', { exact: true }).waitFor();
        await page.locator('#vault-tree-scroll-container').getByTitle('Overview', { exact: true }).click();
        await page.locator('.tiptap').getByText('Child content survives moves.', { exact: true }).waitFor();

        // Deletion returns every descendant and leaves the other branch intact.
        const deleted = await request(`${path}/nodes/${parent.id}`, 'DELETE');
        assert.equal(deleted.status, 200);
        for (const id of [parent.id, child.id, grandchild.id, alpha.id, attachment.id, agentChild.id]) assert(deleted.body.data.deleted_ids.includes(id));
        assert((await request(`${path}/nodes/${folder.id}/children`)).body.children.some(n => n.id === sibling.id));
        const remaining = await context.request.get(`${base}${path}/export`);
        assert.equal(remaining.status(), 200);
        assert.deepEqual(errors, []);
        return 'Nested notes: create, expand, drag, mobile move/retry, A–Z order, cycle guards, rename/move, path resolution, ZIP round trip and recursive delete';
    } catch (error) {
        await page.screenshot({ path: new URL('tree-failure.png', dir).pathname });
        throw error;
    } finally {
        await context.close();
    }
}
