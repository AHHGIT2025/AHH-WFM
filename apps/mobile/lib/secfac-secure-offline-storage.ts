/**
 * SECFAC Secure Mobile Offline Storage Module
 * Implements WebCrypto API (AES-256-GCM) authenticated encryption for offline emergency queue items.
 * Guarantees zero plaintext storage of SOS/emergency payloads in browser/WebView storage.
 */

const KEY_STORAGE_NAME = "secfac_secure_master_v1";

interface EncryptedPayload {
  iv: string; // Base64 or Hex IV (12 bytes)
  ciphertext: string; // Base64 ciphertext + auth tag
}

let cachedCryptoKey: CryptoKey | null = null;

async function getOrCreateCryptoKey(): Promise<CryptoKey> {
  if (cachedCryptoKey) return cachedCryptoKey;

  if (typeof window === "undefined" || !window.crypto || !window.crypto.subtle) {
    throw new Error("WebCrypto API is not supported in this environment.");
  }

  // Retrieve or generate device master key seed from localStorage / Capacitor Preferences
  let rawKeyB64 = localStorage.getItem(KEY_STORAGE_NAME);
  let rawKeyBytes: Uint8Array;

  if (!rawKeyB64) {
    const randomBuffer = new Uint8Array(32); // 256 bits
    window.crypto.getRandomValues(randomBuffer);
    rawKeyB64 = arrayBufferToBase64(randomBuffer.buffer);
    localStorage.setItem(KEY_STORAGE_NAME, rawKeyB64);
    rawKeyBytes = randomBuffer;
  } else {
    rawKeyBytes = new Uint8Array(base64ToArrayBuffer(rawKeyB64));
  }

  // Import as AES-GCM CryptoKey
  cachedCryptoKey = await window.crypto.subtle.importKey(
    "raw",
    rawKeyBytes.buffer as ArrayBuffer,
    { name: "AES-256-GCM" },
    false,
    ["encrypt", "decrypt"]
  );

  return cachedCryptoKey;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Encrypts a plaintext object payload using AES-256-GCM.
 */
export async function encryptPayload<T = any>(payload: T): Promise<EncryptedPayload> {
  const key = await getOrCreateCryptoKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(JSON.stringify(payload));

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-256-GCM",
      iv
    },
    key,
    encodedData
  );

  return {
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(encryptedBuffer)
  };
}

/**
 * Decrypts an AES-256-GCM encrypted payload back to plaintext object.
 */
export async function decryptPayload<T = any>(encrypted: EncryptedPayload): Promise<T> {
  const key = await getOrCreateCryptoKey();
  const iv = new Uint8Array(base64ToArrayBuffer(encrypted.iv));
  const ciphertextBuffer = base64ToArrayBuffer(encrypted.ciphertext);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-256-GCM",
      iv
    },
    key,
    ciphertextBuffer
  );

  const decoder = new TextDecoder();
  const jsonStr = decoder.decode(decryptedBuffer);
  return JSON.parse(jsonStr) as T;
}
