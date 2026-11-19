import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getHttpErrorMessage } from '../src/utils/HttpErrorDetails.ts';

test('prefers the underlying server message over a generic error label', () => {
    assert.equal(getHttpErrorMessage({
        error: 'Account Creation Error',
        message: 'Error encountered while processing the incoming HTTP request: AccountCreation("email exists")',
    }), 'Error encountered while processing the incoming HTTP request: AccountCreation("email exists")');
});

test('uses detail fields and ignores status-only response strings', () => {
    assert.equal(getHttpErrorMessage({ detail: 'The email already exists' }), 'The email already exists');
    assert.equal(getHttpErrorMessage({
        code: 400,
        message: '400 Bad Request',
        error: 'Account Creation Error',
        request_id: '19b34da2-3e78-4679-ba83-d42a12e53b29',
    }), 'Account Creation Error');
    assert.equal(getHttpErrorMessage({
        code: 400,
        message: '400 Bad Request',
        error: 'Account Creation Error',
        request_id: '465c1699-dac7-4b09-aa4d-4b755a6ef76d',
    }, ['detail', 'details', 'message']), undefined);
    assert.equal(getHttpErrorMessage('500 Internal Server Error'), undefined);
});
