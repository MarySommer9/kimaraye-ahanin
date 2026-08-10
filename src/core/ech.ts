// ============================================
// 🦁 کیمارای آهنین - ECH (Encrypted Client Hello)
// ============================================
// ECH یک استاندارد TLS 1.3 است که نام دامنه‌ی SNI را
// در دست‌دادن اولیه رمزنگاری می‌کند.
// در این پیاده‌سازی کلیدهای ECH با Web Crypto API تولید می‌شوند
// و برای کلاینت‌های Sing-box ارائه می‌گردند.

import { Env } from '../types';

// ==================== تایپ‌های ECH ====================
export interface EchKeyPair {
  publicKey:  string;   // base64url — برای کانفیگ کلاینت
  privateKey: string;   // base64url — فقط سمت سرور
  keyId:      number;   // شناسه عددی ۰-۲۵۵
  configId:   string;   // UUID یکتا
  createdAt:  number;
  expiresAt:  number;
}

export interface EchConfig {
  configId:   string;
  keyId:      number;
  publicKey:  string;
  algorithm:  string;
  createdAt:  string;
  expiresAt:  string;
  raw:        string;   // ECHConfigList base64 برای Sing-box
}

// ==================== ثابت‌ها ====================
const KV_ECH_CURRENT  = 'ech:current_key';
const KV_ECH_PREFIX   = 'ech:key:';
const ECH_TTL_MS      = 24 * 60 * 60 * 1000;  // ۲۴ ساعت
const ECH_KV_TTL_SEC  = 24 * 60 * 60 + 3600;  // ۲۵ ساعت در KV

// ==================== هندلر اصلی ECH ====================
export async function handleECH(request: Request, env: Env): Promise<Response> {
  const url    = new URL(request.url);
  const action = url.pathname.split('/').pop() || '';

  // احراز هویت برای keygen
  if (action === 'keygen') {
    const adminToken = await env.KV.get('admin_token') || 'admin123';
    const token      = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token || token !== adminToken) {
      return new Response('Unauthorized', { status: 401 });
    }
    return handleEchKeyGen(env);
  }

  // endpoint عمومی برای دریافت کانفیگ ECH
  if (action === 'config') {
    return handleEchConfig(env, url);
  }

  return new Response(JSON.stringify({ error: 'آکشن نامعتبر. از /ech/keygen یا /ech/config استفاده کنید' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ==================== تولید کلید ECH ====================
/**
 * یک جفت کلید ECDH P-256 تولید می‌کند که به‌عنوان ECH key pair استفاده می‌شود.
 * در محیط Workers، X25519 برای ECH استفاده می‌شود (با P-256 fallback).
 */
async function handleEchKeyGen(env: Env): Promise<Response> {
  try {
    const keyPair = await generateEchKeyPair();

    // ذخیره در KV
    await env.KV.put(
      `${KV_ECH_PREFIX}${keyPair.configId}`,
      JSON.stringify(keyPair),
      { expirationTtl: ECH_KV_TTL_SEC }
    );
    await env.KV.put(KV_ECH_CURRENT, keyPair.configId, { expirationTtl: ECH_KV_TTL_SEC });

    return new Response(JSON.stringify({
      success:   true,
      configId:  keyPair.configId,
      keyId:     keyPair.keyId,
      publicKey: keyPair.publicKey,
      expiresAt: new Date(keyPair.expiresAt).toISOString(),
      message:   '✅ کلید ECH با موفقیت تولید شد. هر ۲۴ ساعت یک‌بار تجدید می‌شود.',
    }, null, 2), {
      status:  201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'خطا در تولید کلید ECH', detail: err.message }), {
      status:  500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ==================== دریافت کانفیگ ECH ====================
async function handleEchConfig(env: Env, url: URL): Promise<Response> {
  const configId = url.searchParams.get('id') || await env.KV.get(KV_ECH_CURRENT);
  if (!configId) {
    return new Response(JSON.stringify({
      error: 'کلید ECH تنظیم نشده. ادمین باید ابتدا /ech/keygen را اجرا کند.',
    }), {
      status:  404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const raw = await env.KV.get(`${KV_ECH_PREFIX}${configId}`, 'json') as EchKeyPair | null;
  if (!raw) {
    return new Response(JSON.stringify({ error: 'کلید یافت نشد یا منقضی شده' }), {
      status:  404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const config = buildEchConfig(raw);

  return new Response(JSON.stringify(config, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `max-age=${Math.floor((raw.expiresAt - Date.now()) / 1000)}`,
    },
  });
}

// ==================== تولید جفت کلید ECH ====================
export async function generateEchKeyPair(): Promise<EchKeyPair> {
  let pubKeyB64: string;
  let privKeyB64: string;

  try {
    // X25519 — مناسب‌ترین برای ECH (HPKE)
    const kp = await (crypto.subtle as any).generateKey(
      { name: 'ECDH', namedCurve: 'X25519' },
      true,
      ['deriveKey', 'deriveBits']
    ) as CryptoKeyPair;
    const pub  = await crypto.subtle.exportKey('raw',   kp.publicKey);
    const priv = await crypto.subtle.exportKey('pkcs8', kp.privateKey);
    pubKeyB64  = toBase64Url(new Uint8Array(pub as ArrayBuffer));
    privKeyB64 = toBase64Url(new Uint8Array(priv as ArrayBuffer));
  } catch {
    // P-256 fallback
    const kp = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    ) as CryptoKeyPair;
    const pub  = await crypto.subtle.exportKey('spki',  kp.publicKey);
    const priv = await crypto.subtle.exportKey('pkcs8', kp.privateKey);
    pubKeyB64  = toBase64Url(new Uint8Array(pub as ArrayBuffer));
    privKeyB64 = toBase64Url(new Uint8Array(priv as ArrayBuffer));
  }

  const keyId    = Math.floor(Math.random() * 256);
  const configId = crypto.randomUUID();
  const now      = Date.now();

  return {
    publicKey:  pubKeyB64,
    privateKey: privKeyB64,
    keyId,
    configId,
    createdAt:  now,
    expiresAt:  now + ECH_TTL_MS,
  };
}

// ==================== ساخت EchConfig برای کلاینت ====================
function buildEchConfig(kp: EchKeyPair): EchConfig {
  // ساخت ECHConfigList (RFC 9180 / TLS ECH draft)
  // فرمت: version(2) | length(2) | keyId(1) | kem(2) | publicKey | cipher_suites | max_name_len | ext_len
  const pubBytes = fromBase64Url(kp.publicKey);

  // HPKE KEM: 0x0020 = DHKEM(X25519, HKDF-SHA256) یا 0x0010 = DHKEM(P-256, HKDF-SHA256)
  const kemId = pubBytes.length === 32 ? 0x0020 : 0x0010;

  // ساخت ECHConfig به‌صورت دستی (TLS extension format)
  const buf = new Uint8Array(100);
  let offset = 0;

  // ECHConfig version = 0xfe0d (draft-13)
  buf[offset++] = 0xfe; buf[offset++] = 0x0d;

  // length placeholder
  const lenOffset = offset; offset += 2;

  // key_config: key_id
  buf[offset++] = kp.keyId;

  // kem_id
  buf[offset++] = (kemId >> 8) & 0xff;
  buf[offset++] = kemId & 0xff;

  // public_key length + bytes
  buf[offset++] = 0;
  buf[offset++] = pubBytes.length;
  buf.set(pubBytes, offset); offset += pubBytes.length;

  // cipher_suites: 1 suite, [HKDF-SHA256(0x0001), AES-128-GCM(0x0001)]
  buf[offset++] = 0; buf[offset++] = 4; // list length
  buf[offset++] = 0x00; buf[offset++] = 0x01; // kdf_id: HKDF-SHA256
  buf[offset++] = 0x00; buf[offset++] = 0x01; // aead_id: AES-128-GCM

  // maximum_name_length
  buf[offset++] = 0; // 0 = unlimited

  // extensions length = 0
  buf[offset++] = 0; buf[offset++] = 0;

  // patch total length
  const bodyLen = offset - lenOffset - 2;
  buf[lenOffset]   = (bodyLen >> 8) & 0xff;
  buf[lenOffset+1] = bodyLen & 0xff;

  const echBytes   = buf.slice(0, offset);
  const rawBase64  = toBase64Url(echBytes);

  return {
    configId:  kp.configId,
    keyId:     kp.keyId,
    publicKey: kp.publicKey,
    algorithm: kemId === 0x0020 ? 'DHKEM(X25519, HKDF-SHA256)' : 'DHKEM(P-256, HKDF-SHA256)',
    createdAt: new Date(kp.createdAt).toISOString(),
    expiresAt: new Date(kp.expiresAt).toISOString(),
    raw:       rawBase64,
  };
}

// ==================== دریافت کانفیگ ECH فعلی (برای subscriptions) ====================
export async function getCurrentEchConfig(env: Env): Promise<EchConfig | null> {
  try {
    const configId = await env.KV.get(KV_ECH_CURRENT);
    if (!configId) return null;

    const kp = await env.KV.get(`${KV_ECH_PREFIX}${configId}`, 'json') as EchKeyPair | null;
    if (!kp || kp.expiresAt < Date.now()) return null;

    return buildEchConfig(kp);
  } catch {
    return null;
  }
}

// ==================== توابع کمکی base64url ====================
function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64url: string): Uint8Array {
  const b64    = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  return new Uint8Array(binary.split('').map((c: any) => c.charCodeAt(0)));
}
