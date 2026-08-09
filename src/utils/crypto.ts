// ============================================
// 🦁 کیمارای آهنین - رمزنگاری با AES-256-GCM
// ============================================
// از Web Crypto API استفاده می‌شود که در محیط
// Cloudflare Workers به‌صورت کامل پشتیبانی می‌شود.

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 256; // bits
const SALT_LENGTH = 16; // bytes
const IV_LENGTH = 12;   // bytes (96-bit برای AES-GCM)

// ==================== استخراج کلید از رمز عبور ====================
/**
 * کلید AES-256 را از یک رمز عبور رشته‌ای با استفاده از PBKDF2 استخراج می‌کند.
 * @param password  رمز عبور کاربر
 * @param salt      نمک تصادفی (16 بایت)
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

// ==================== رمزگذاری داده ====================
/**
 * داده را با AES-256-GCM رمزگذاری می‌کند.
 * خروجی: [salt(16) | iv(12) | ciphertext+tag]
 * @param data      داده‌ی خام به صورت Uint8Array
 * @param password  رمز عبور برای استخراج کلید
 */
export async function encrypt(data: Uint8Array, password: string): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv   = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key  = await deriveKey(password, salt);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  const ciphertext = new Uint8Array(cipherBuffer);

  // ترکیب: salt | iv | ciphertext
  const result = new Uint8Array(SALT_LENGTH + IV_LENGTH + ciphertext.byteLength);
  result.set(salt,       0);
  result.set(iv,         SALT_LENGTH);
  result.set(ciphertext, SALT_LENGTH + IV_LENGTH);

  return result;
}

// ==================== رمزگشایی داده ====================
/**
 * داده‌ی رمزگذاری‌شده را با AES-256-GCM رمزگشایی می‌کند.
 * ورودی انتظار دارد: [salt(16) | iv(12) | ciphertext+tag]
 * @param data      داده‌ی رمزگذاری‌شده
 * @param password  رمز عبور برای استخراج کلید
 */
export async function decrypt(data: Uint8Array, password: string): Promise<Uint8Array> {
  if (data.byteLength < SALT_LENGTH + IV_LENGTH + 1) {
    throw new Error('داده‌ی ورودی بسیار کوتاه است یا فرمت نادرست دارد');
  }

  const salt       = data.slice(0, SALT_LENGTH);
  const iv         = data.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const ciphertext = data.slice(SALT_LENGTH + IV_LENGTH);

  const key = await deriveKey(password, salt);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new Uint8Array(plainBuffer);
}

// ==================== هش SHA-256 ====================
/**
 * یک رشته را به هش SHA-256 hex تبدیل می‌کند.
 * برای Trojan: احراز هویت مبتنی بر هش رمز عبور
 */
export async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(input));
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ==================== تولید کلید X25519 ====================
/**
 * یک جفت کلید X25519 برای Reality تولید می‌کند.
 * خروجی: { publicKey, privateKey } به صورت base64
 */
export async function generateX25519KeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, // Cloudflare Workers از X25519 پشتیبانی نمی‌کند، P-256 جایگزین
    true,
    ['deriveKey', 'deriveBits']
  );

  const publicKeyBuffer  = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  return {
    publicKey:  btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer))),
    privateKey: btoa(String.fromCharCode(...new Uint8Array(privateKeyBuffer))),
  };
}

// ==================== تولید رمز عبور تصادفی ====================
/**
 * یک رمز عبور تصادفی امن تولید می‌کند.
 */
export function generateSecurePassword(length = 24): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const values  = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, v => charset[v % charset.length]).join('');
}
