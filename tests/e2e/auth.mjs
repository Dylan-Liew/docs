import assert from 'node:assert/strict';

// Real HTTP/browser checks against the runner's disposable database and keys.
export async function auth({ base, browser, jwt, fixture, bearer }) {
    const checks = [];
    const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream'
    };
    const request = (extra = {}, params = { name: 'me', arguments: {} }) =>
        fetch(`${base}/mcp`, {
            method: 'POST',
            headers: { ...headers, ...extra },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params })
        });
    async function call(email, name, args = {}) {
        const response = await request(
            { 'Cf-Access-Jwt-Assertion': jwt(email) },
            { name, arguments: args }
        );
        assert.equal(response.status, 200);
        const { result, error } = await response.json();
        assert(!error);
        return result;
    }
    const data = (result) => {
        assert(!result.isError, result.content[0].text);
        return JSON.parse(result.content[0].text);
    };
    async function home(email) {
        const response = await fetch(`${base}/vaults`, {
            headers: { 'Cf-Access-Jwt-Assertion': jwt(email) }
        });
        assert.equal(response.status, 200);
        const page = (await response.text()).match(/<script\b[^>]*data-page="app"[^>]*>([\s\S]*?)<\/script>/);
        assert(page, 'Browser bootstrap must include Inertia page data');
        return JSON.parse(page[1]).props;
    }
    async function collaboration(page, path, method, body) {
        return page.evaluate(async ({ path, method, body }) => {
            const cookie = document.cookie.split('; ').find((value) => value.startsWith('XSRF-TOKEN='));
            const response = await fetch(path, {
                method,
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': decodeURIComponent(cookie.slice('XSRF-TOKEN='.length))
                },
                body: body ? JSON.stringify(body) : undefined
            });
            return response.status;
        }, { path, method, body });
    }

    for (const email of ['alex@example.test', 'sam@example.test']) {
        const web = await home(email);
        const identity = data(await call(email, 'me'));
        assert.equal(identity.id, web.app.user.id);
        assert.equal(identity.email, web.app.user.email);
        assert.deepEqual(
            data(await call(email, 'vaults')).data.map((v) => v.id).sort(),
            web.visibleVaults.map((v) => v.id).sort()
        );
    }
    const owner = data(await call('alex@example.test', 'me'));
    assert.equal(data(await call('ALEX@example.test', 'me')).id, owner.id);
    const first = data(await call('mcp-first@example.test', 'me'));
    assert.deepEqual(data(await call('mcp-first@example.test', 'vaults')).data, []);
    assert.equal((await home('mcp-first@example.test')).app.user.id, first.id);
    checks.push('Browser and MCP share user IDs and vault permissions, including case normalization and MCP-first sign-in');

    for (const extra of [
        {},
        { Authorization: `Bearer ${bearer}`, 'Cf-Access-Authenticated-User-Email': 'alex@example.test' },
        { 'Cf-Access-Jwt-Assertion': jwt('alex@example.test', 'agents'), Authorization: `Bearer ${bearer}` },
        { 'Cf-Access-Jwt-Assertion': jwt('alex@example.test', 'browser', { exp: 1 }) },
        { 'Cf-Access-Jwt-Assertion': jwt('alex@example.test', 'browser', { iss: 'https://other.cloudflareaccess.com' }) },
        { 'Cf-Access-Jwt-Assertion': jwt('alex@example.test', 'browser', { common_name: 'service-token', sub: '' }) },
        { 'Cf-Access-Jwt-Assertion': jwt('agent@example.test') },
        { 'Cf-Access-Jwt-Assertion': jwt('not-an-email') },
        { 'Cf-Access-Jwt-Assertion': jwt('alex@example.test'), Origin: 'https://other.example.test' }
    ]) {
        assert.equal((await request(extra)).status, 403);
    }
    checks.push('MCP rejects missing identity, retired credentials, wrong issuer/audience, expired assertions, service accounts and foreign origins');

    const ownVault = fixture.vaults[0];
    const privateVault = fixture.vaults[5];
    assert((await call('alex@example.test', 'list', { vaultId: privateVault })).isError);
    assert((await call('alex@example.test', 'create', { vaultId: privateVault, name: 'Denied', content: '' })).isError);
    const privateNote = data(await call('sam@example.test', 'list', { vaultId: privateVault })).data[0];
    assert((await call('alex@example.test', 'read', { noteId: privateNote.id })).isError);
    assert((await call('alex@example.test', 'update', { noteId: privateNote.id, content: 'Denied' })).isError);
    const written = data(await call('alex@example.test', 'create', { vaultId: ownVault, name: 'Identity check', content: '# Same account' }));
    assert((await call('sam@example.test', 'read', { noteId: written.id })).isError);
    const context = await browser.newContext({ extraHTTPHeaders: { 'Cf-Access-Jwt-Assertion': jwt('alex@example.test') } });
    try {
        const page = await context.newPage();
        await page.goto(`${base}/vaults/${ownVault}?file=${written.id}`);
        await page.locator('.tiptap').getByRole('heading', { name: 'Same account', exact: true }).waitFor();
        const web = await home('alex@example.test');
        assert.equal(web.app.user.id, owner.id);
        assert.equal(await collaboration(page, `/vaults/${fixture.vaults[4]}/collaborations/${owner.id}`, 'DELETE'), 200);
        assert((await call('alex@example.test', 'list', { vaultId: fixture.vaults[4] })).isError);
        assert(!(await home('alex@example.test')).visibleVaults.some((v) => v.id === fixture.vaults[4]));
    } finally {
        await context.close();
    }
    // Restore only this fixture membership for the existing sharing/UI checks.
    const other = await browser.newContext({ extraHTTPHeaders: { 'Cf-Access-Jwt-Assertion': jwt('sam@example.test') } });
    try {
        const page = await other.newPage();
        await page.goto(`${base}/vaults/${fixture.vaults[4]}`);
        await page.locator('#app-header').waitFor();
        assert.equal(await collaboration(page, `/vaults/${fixture.vaults[4]}/collaborations`, 'POST', { email: 'alex@example.test' }), 200);
    } finally {
        await other.close();
    }
    checks.push('MCP-created notes open in the browser; private/pending reads and writes stay blocked; revocation applies to both');
    return checks;
}
