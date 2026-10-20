import test from 'node:test';
import assert from 'node:assert/strict';
import {
    encryptField,
    encryptFieldJson,
    decryptFieldStrict,
    validateLuhn,
    validateExpiry,
    validateCvv,
    maskCardNumber,
    maskAccountNumber
} from './crypto.js';

test('Deterministic Test Vectors from crypto-spec.md', async (t) => {
    const passphrase = 'pem-test-vault-passphrase-2026';

    await t.test('Vector 1: Credit Card Number (4532712398762038)', async () => {
        const payload = 'gcm1:AQIDBAUGBwgJCgsMDQ4PEA==:AQIDBAUGBwgJCgsM:vcrV/mRvIazsbPmHATjzf1x+iQB2/GBkH/+oZk+Y11E=:2038';
        const res = await decryptFieldStrict(payload, passphrase);
        assert.equal(res.success, true);
        assert.equal(res.value, '4532712398762038');
        assert.equal(validateLuhn(res.value), true);
    });

    await t.test('Vector 2: Bank Account Number (923892382038)', async () => {
        const payload = 'gcm1:AQIDBAUGBwgJCgsMDQ4PEA==:AQIDBAUGBwgJCgsM:sM3V9GpsIKfnZP2JlFkjusZI615ghW1gaejdZg==:2038';
        const res = await decryptFieldStrict(payload, passphrase);
        assert.equal(res.success, true);
        assert.equal(res.value, '923892382038');
    });

    await t.test('Vector 3: CVV (832)', async () => {
        const payload = 'gcm1:AQIDBAUGBwgJCgsMDQ4PEA==:AQIDBAUGBwgJCgsM:sczU+lgt7iP+YHQZ/AAkMBo1LA==';
        const res = await decryptFieldStrict(payload, passphrase);
        assert.equal(res.success, true);
        assert.equal(res.value, '832');
        assert.equal(validateCvv(res.value), true);
    });
});

test('Roundtrip Encryption & Decryption', async (t) => {
    const passphrase = 'user-custom-secret-key-123';
    const card = '4532712398762038';

    await t.test('Format A: gcm1 string format', async () => {
        const encrypted = await encryptField(card, passphrase);
        assert.match(encrypted, /^gcm1:/);
        assert.equal(encrypted.endsWith('2038'), true);

        const res = await decryptFieldStrict(encrypted, passphrase);
        assert.equal(res.success, true);
        assert.equal(res.value, card);
    });

    await t.test('Format B: JSON envelope format', async () => {
        const encrypted = await encryptFieldJson(card, passphrase);
        const parsed = JSON.parse(encrypted);
        assert.equal(parsed.v, 1);
        assert.equal(parsed.alg, 'AES-256-GCM');

        const res = await decryptFieldStrict(encrypted, passphrase);
        assert.equal(res.success, true);
        assert.equal(res.value, card);
    });
});

test('Strict Decryption Invariant: Never Show Garbage', async (t) => {
    const validPayload = 'gcm1:AQIDBAUGBwgJCgsMDQ4PEA==:AQIDBAUGBwgJCgsM:vcrV/mRvIazsbPmHATjzf1x+iQB2/GBkH/+oZk+Y11E=:2038';
    
    // Wrong passphrase
    const resWrongPass = await decryptFieldStrict(validPayload, 'wrong-passphrase');
    assert.equal(resWrongPass.success, false);
    assert.equal(resWrongPass.error, "Can't decrypt, re-enter or re-sync");

    // Corrupted tag/ciphertext
    const corruptedPayload = 'gcm1:AQIDBAUGBwgJCgsMDQ4PEA==:AQIDBAUGBwgJCgsM:corrupted+ciphertext+tampered=:2038';
    const resCorrupted = await decryptFieldStrict(corruptedPayload, 'pem-test-vault-passphrase-2026');
    assert.equal(resCorrupted.success, false);
});

test('Field Validations', () => {
    // Luhn
    assert.equal(validateLuhn('4532712398762038'), true);
    assert.equal(validateLuhn('4532712398742038'), false);
    assert.equal(validateLuhn('1234'), false);

    // Expiry
    assert.equal(validateExpiry('12/28'), true);
    assert.equal(validateExpiry('01/30'), true);
    assert.equal(validateExpiry('13/28'), false);
    assert.equal(validateExpiry('00/28'), false);
    assert.equal(validateExpiry('invalid'), false);

    // CVV
    assert.equal(validateCvv('832'), true);
    assert.equal(validateCvv('1234'), true);
    assert.equal(validateCvv('12'), false);
    assert.equal(validateCvv('12345'), false);
});

test('Masking and Suffix Preservation', () => {
    const payload = 'gcm1:AQIDBAUGBwgJCgsMDQ4PEA==:AQIDBAUGBwgJCgsM:sM3V9GpsIKfnZP2JlFkjusZI615ghW1gaejdZg==:2038';
    assert.equal(maskCardNumber(payload), '•••• •••• •••• 2038');
    assert.equal(maskAccountNumber(payload), '•••• 2038');
});
