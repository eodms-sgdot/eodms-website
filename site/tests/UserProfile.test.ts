import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import axios from 'axios';
import { createServer } from 'vite';

let server;
let service;
let cacheDir;

before(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), 'eodms-profile-test-'));
    server = await createServer({
        root: fileURLToPath(new URL('..', import.meta.url)),
        cacheDir, configFile: false, server: { middlewareMode: true }, appType: 'custom',
        optimizeDeps: { noDiscovery: true },
    });
    service = await server.ssrLoadModule('/src/services/AAAService.tsx');
});

after(async () => {
    await server?.close();
    if (cacheDir) await rm(cacheDir, { recursive: true, force: true });
});

test('user API requests use the CLI paths, payloads and bearer authentication', async () => {
    const calls = [];
    const adapter = axios.defaults.adapter;
    axios.defaults.adapter = async config => {
        calls.push({
            method: config.method,
            url: config.url,
            authorization: config.headers.get('Authorization'),
            data: config.data ? JSON.parse(config.data) : undefined,
        });
        return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
    };
    try {
        const account = {
            username: 'test-user', password: 'a-test-password', given_name: 'Test',
            surname: 'User', email: 'test@example.test', language: 'English',
        };
        const update = {
            email: 'updated@example.test',
            shipping_address: {
                'street-address': '1 Example Street', city: 'Ottawa', province: 'Ontario',
                country: 'Canada', 'postal-code': 'K1A 0B1',
            },
            language: 'French',
        };
        await service.createUserAccount('/aaa/v1/users', account);
        await service.getUserProfile('/aaa/v1/users/', 'test/user', 'test-token');
        await service.updateUserProfile('/aaa/v1/users/', 'test/user', 'test-token', update);
        await service.updateUserProfile('/aaa/v1/users', 'test/user', 'test-token', { password: 'new-test-password' });
        assert.deepEqual(calls, [
            { method: 'post', url: '/aaa/v1/users', authorization: undefined, data: account },
            { method: 'get', url: '/aaa/v1/users/test%2Fuser', authorization: 'Bearer test-token', data: undefined },
            { method: 'patch', url: '/aaa/v1/users/test%2Fuser', authorization: 'Bearer test-token', data: update },
            { method: 'patch', url: '/aaa/v1/users/test%2Fuser', authorization: 'Bearer test-token', data: { password: 'new-test-password' } },
        ]);
    } finally {
        axios.defaults.adapter = adapter;
    }
});

test('reads nested AAA profile addresses and maps language codes to update values', () => {
    const profile = {
        'personal-information': {
            identification: { name: { 'given-name': 'Test', surname: 'User' } },
            'contact-information': {
                email: 'test@example.test',
                address: [
                    { '@type': 'shipping', city: 'Toronto' },
                    { '@type': 'main', 'street-address': '1 Example Street', city: 'Ottawa' },
                    { '@type': 'billing', city: 'Montreal' },
                ],
            },
        },
        environment: { language: 'en' },
    };
    assert.deepEqual(service.readUserProfile(profile), {
        given_name: 'Test', surname: 'User', email: 'test@example.test',
        address: { 'street-address': '1 Example Street', city: 'Ottawa' },
        shipping_address: { city: 'Toronto' }, billing_address: { city: 'Montreal' },
        language: 'English',
    });
    assert.equal(service.readUserProfile({ environment: { language: 'fr' } }).language, 'French');
    assert.equal(service.readUserProfile({ language: 'English' }).language, 'English');
});
