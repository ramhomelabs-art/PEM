# PEM Pro Shared Cryptographic Specification

## 1. Overview
This specification documents the standard client vault encryption and decryption scheme shared between the PEM Pro Web application (React/Vite) and the Android mobile application (Jetpack Compose).

All sensitive financial records stored in the vault (bank account numbers, credit/debit card numbers, and card verification values (CVV)) are encrypted client-side using authenticated symmetric encryption before being sent to or stored in the database.

---

## 2. Cryptographic Parameters

| Parameter | Specification | Notes |
| :--- | :--- | :--- |
| **Cipher Algorithm** | `AES/GCM/NoPadding` | 256-bit key in Galois/Counter Mode (GCM) |
| **Key Derivation Function (KDF)** | `PBKDF2WithHmacSHA256` | RFC 8018 / PKCS #5 v2.1 |
| **KDF Iterations** | `100,000` | Recommended minimum for vault derivation |
| **KDF Hash** | `SHA-256` | 32-byte digest |
| **Key Size** | 256 bits (32 bytes) | Derived AES key |
| **Salt Length** | 16 bytes (128 bits) | Cryptographically secure random bytes per record |
| **Initialization Vector (IV)** | 12 bytes (96 bits) | Cryptographically secure random bytes per record (NIST SP 800-38D) |
| **Authentication Tag Length** | 16 bytes (128 bits) | Appended directly to ciphertext buffer |
| **Character Encoding** | `UTF-8` | Input plaintext & decrypted string |
| **Binary-to-Text Encoding** | Standard Base64 (RFC 4648 §4) | With standard `=` padding |

---

## 3. Envelope Formats

Both the Web and Android clients support two envelope encodings for encrypted fields:

### Format A: Versioned Colon String (Compact)
```text
gcm1:<salt_base64>:<iv_base64>:<ciphertext_and_tag_base64>:<visible_suffix>
```
- Segment 0: `gcm1` (version identifier: GCM version 1)
- Segment 1: Base64-encoded 16-byte random salt
- Segment 2: Base64-encoded 12-byte random IV
- Segment 3: Base64-encoded combined buffer: `[ciphertext || 16-byte auth tag]`
- Segment 4 (optional): Non-sensitive trailing digits (`visible_suffix`), allowing UI components to display at least half the account number or the last 4 card digits without decrypting the entire record.

### Format B: Versioned JSON Envelope
```json
{
  "v": 1,
  "alg": "AES-256-GCM",
  "kdf": "PBKDF2-HMAC-SHA256",
  "iter": 100000,
  "salt": "<salt_base64>",
  "iv": "<iv_base64>",
  "ct": "<ciphertext_and_tag_base64>",
  "suffix": "<visible_suffix>"
}
```

---

## 4. Test Vectors (Cross-Platform Parity)

These test vectors provide deterministic known-answer tests across JavaScript (Web Crypto API), Node.js (OpenSSL), and Kotlin/Android (`javax.crypto`).

### Master Test Input
- **Passphrase**: `pem-test-vault-passphrase-2026`
- **Salt (Hex)**: `0102030405060708090a0b0c0d0e0f10`
- **Salt (Base64)**: `AQIDBAUGBwgJCgsMDQ4PEA==`
- **IV (Hex)**: `0102030405060708090a0b0c`
- **IV (Base64)**: `AQIDBAUGBwgJCgsM`

### Vector 1: Credit Card Number
- **Plaintext**: `4532712398762038`
- **Visible Suffix**: `2038`
- **Expected Ciphertext + Tag (Base64)**: `vcrV/mRvIazsbPmHATjzf1x+iQB2/GBkH/+oZk+Y11E=`
- **Expected `gcm1` String**:
  ```text
  gcm1:AQIDBAUGBwgJCgsMDQ4PEA==:AQIDBAUGBwgJCgsM:vcrV/mRvIazsbPmHATjzf1x+iQB2/GBkH/+oZk+Y11E=:2038
  ```

### Vector 2: Bank Account Number
- **Plaintext**: `923892382038`
- **Visible Suffix**: `2038`
- **Expected Ciphertext + Tag (Base64)**: `sM3V9GpsIKfnZP2JlFkjusZI615ghW1gaejdZg==`
- **Expected `gcm1` String**:
  ```text
  gcm1:AQIDBAUGBwgJCgsMDQ4PEA==:AQIDBAUGBwgJCgsM:sM3V9GpsIKfnZP2JlFkjusZI615ghW1gaejdZg==:2038
  ```

### Vector 3: Card Verification Value (CVV)
- **Plaintext**: `832`
- **Visible Suffix**: *(none)*
- **Expected Ciphertext + Tag (Base64)**: `sczU+lgt7iP+YHQZ/AAkMBo1LA==`
- **Expected `gcm1` String**:
  ```text
  gcm1:AQIDBAUGBwgJCgsMDQ4PEA==:AQIDBAUGBwgJCgsM:sczU+lgt7iP+YHQZ/AAkMBo1LA==
  ```

---

## 5. Decryption & Validation Invariants

### 5.1 Strict Decryption Invariant: "Never Show Garbage"
If decryption fails (e.g. incorrect passphrase, corrupted Base64, authentication tag mismatch, or tampering):
1. **Never return or render raw garbage, broken Base64, or pseudo-dots.**
2. The decryption result is wrapped in a `DecryptionResult` state:
   - `Success(val: String)`
   - `Error(reason: String)` (e.g., `"Decryption failed (Authentication error)"`)
3. The UI MUST display an explicit error state:
   - *"Can't decrypt, re-enter or re-sync"* with an interactive **Retry** button.

### 5.2 Post-Decryption Validation Rules
After successful GCM tag verification, values must be strictly validated:
1. **Card Number**:
   - Must contain only digits, length between 13 and 19 characters.
   - Must pass the **Luhn Algorithm** (`mod 10` checksum).
2. **Expiry Date**:
   - Format must strictly match `MM/YY` (regex: `^(0[1-9]|1[0-2])\/([0-9]{2})$`).
   - Month must be between `1` and `12`.
   - Year must be within acceptable range (current year - 5 to current year + 25).
3. **Card CVV**:
   - Must contain only digits, length 3 or 4.

---

## 6. Key Management & Android Keystore

1. **Root Secret Storage**:
   - On Android, sensitive secrets and vault passphrases are stored encrypted in Android Keystore using `EncryptedSharedPreferences` (`AES256_GCM`).
2. **In-Memory Lifetime**:
   - Decrypted plaintext values are held in memory only during the active reveal session (maximum 10 seconds).
   - Plaintext values are never stored in Room/SQLite, never logged, and wiped on lock/timeout.
3. **Screen Protection**:
   - Views displaying unmasked card numbers or CVV set `WindowManager.LayoutParams.FLAG_SECURE` to prevent screen capture, recent app previews, or recording.
