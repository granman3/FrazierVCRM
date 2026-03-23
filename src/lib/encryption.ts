import sodium from "sodium-native";

/**
 * Encryption module using libsodium for envelope encryption.
 *
 * Each secret is encrypted with a random data key (DEK).
 * The DEK is encrypted with the master key (KEK from ENCRYPTION_KEY env var).
 * Both are stored together in a single payload.
 *
 * Format: base64(nonce || encrypted_dek || nonce2 || ciphertext)
 */

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

// Key derivation parameters
const KEY_BYTES = sodium.crypto_secretbox_KEYBYTES;
const NONCE_BYTES = sodium.crypto_secretbox_NONCEBYTES;
const MAC_BYTES = sodium.crypto_secretbox_MACBYTES;

/**
 * Derives the master key from the environment variable.
 * The ENCRYPTION_KEY should be a base64-encoded 32-byte key.
 */
function getMasterKey(): Buffer {
  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }

  const key = Buffer.from(ENCRYPTION_KEY, "base64");

  if (key.length !== KEY_BYTES) {
    throw new Error(
      `ENCRYPTION_KEY must be ${KEY_BYTES} bytes (${KEY_BYTES * 4 / 3} base64 characters), got ${key.length} bytes`
    );
  }

  return key;
}

/**
 * Generates a random data encryption key (DEK).
 */
function generateDEK(): Buffer {
  const key = Buffer.alloc(KEY_BYTES);
  sodium.randombytes_buf(key);
  return key;
}

/**
 * Generates a random nonce.
 */
function generateNonce(): Buffer {
  const nonce = Buffer.alloc(NONCE_BYTES);
  sodium.randombytes_buf(nonce);
  return nonce;
}

/**
 * Encrypts data using the secretbox algorithm.
 */
function secretboxEncrypt(
  plaintext: Buffer,
  key: Buffer,
  nonce: Buffer
): Buffer {
  const ciphertext = Buffer.alloc(plaintext.length + MAC_BYTES);
  sodium.crypto_secretbox_easy(ciphertext, plaintext, nonce, key);
  return ciphertext;
}

/**
 * Decrypts data using the secretbox algorithm.
 */
function secretboxDecrypt(
  ciphertext: Buffer,
  key: Buffer,
  nonce: Buffer
): Buffer {
  const plaintext = Buffer.alloc(ciphertext.length - MAC_BYTES);
  const success = sodium.crypto_secretbox_open_easy(
    plaintext,
    ciphertext,
    nonce,
    key
  );

  if (!success) {
    throw new Error("Decryption failed - invalid ciphertext or key");
  }

  return plaintext;
}

/**
 * Encrypts a secret using envelope encryption.
 *
 * @param plaintext - The secret to encrypt (string or object)
 * @returns Base64-encoded encrypted payload
 */
export function encryptSecret(plaintext: string | object): string {
  const masterKey = getMasterKey();
  const dek = generateDEK();

  // Convert plaintext to buffer
  const plaintextBuffer = Buffer.from(
    typeof plaintext === "string" ? plaintext : JSON.stringify(plaintext),
    "utf8"
  );

  // Encrypt the DEK with the master key
  const dekNonce = generateNonce();
  const encryptedDek = secretboxEncrypt(dek, masterKey, dekNonce);

  // Encrypt the plaintext with the DEK
  const dataNonce = generateNonce();
  const encryptedData = secretboxEncrypt(plaintextBuffer, dek, dataNonce);

  // Securely clear the DEK from memory
  sodium.sodium_memzero(dek);

  // Combine all parts: dekNonce || encryptedDek || dataNonce || encryptedData
  const payload = Buffer.concat([dekNonce, encryptedDek, dataNonce, encryptedData]);

  return payload.toString("base64");
}

/**
 * Decrypts a secret that was encrypted with encryptSecret.
 *
 * @param encrypted - Base64-encoded encrypted payload
 * @returns Decrypted secret as string
 */
export function decryptSecret(encrypted: string): string {
  const masterKey = getMasterKey();
  const payload = Buffer.from(encrypted, "base64");

  // Calculate sizes
  const dekNonceEnd = NONCE_BYTES;
  const encryptedDekEnd = dekNonceEnd + KEY_BYTES + MAC_BYTES;
  const dataNonceEnd = encryptedDekEnd + NONCE_BYTES;

  // Extract parts
  const dekNonce = payload.subarray(0, dekNonceEnd);
  const encryptedDek = payload.subarray(dekNonceEnd, encryptedDekEnd);
  const dataNonce = payload.subarray(encryptedDekEnd, dataNonceEnd);
  const encryptedData = payload.subarray(dataNonceEnd);

  // Decrypt the DEK
  const dek = secretboxDecrypt(encryptedDek, masterKey, dekNonce);

  // Decrypt the data
  const plaintext = secretboxDecrypt(encryptedData, dek, dataNonce);

  // Securely clear the DEK from memory
  sodium.sodium_memzero(dek);

  return plaintext.toString("utf8");
}

/**
 * Decrypts a secret and parses it as JSON.
 *
 * @param encrypted - Base64-encoded encrypted payload
 * @returns Parsed JSON object
 */
export function decryptSecretJSON<T = unknown>(encrypted: string): T {
  const plaintext = decryptSecret(encrypted);
  return JSON.parse(plaintext) as T;
}

/**
 * Generates a new encryption key for initial setup.
 * Run this once and store the output in ENCRYPTION_KEY env var.
 */
export function generateEncryptionKey(): string {
  const key = Buffer.alloc(KEY_BYTES);
  sodium.randombytes_buf(key);
  return key.toString("base64");
}

/**
 * Rotates a secret to use a new DEK (re-encrypts with same master key).
 * Useful for key rotation best practices.
 */
export function rotateSecret(encrypted: string): string {
  const plaintext = decryptSecret(encrypted);
  return encryptSecret(plaintext);
}

// Export types for credentials
export interface ICloudCredentials {
  appleId: string;
  appSpecificPassword: string;
}

export interface GoogleContactsCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface ProxycurlCredentials {
  apiKey: string;
}
