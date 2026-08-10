// ============================================
// 🦁 کیمارای آهنین - موتور تغییر پارامترها (Morph)
// ============================================

import { SecurityLayer } from '../../types';

let currentMorph: SecurityLayer = {
  morphEnabled: true,
  decoyEnabled: true,
  fragmentEnabled: true,
  tlsFingerprint: 'random',
  dynamicTTL: true
};

let lastUpdate = Date.now();

// ==================== دریافت تنظیمات مورف ====================
export function getMorphConfig(): SecurityLayer {
  const now = Date.now();
  if (now - lastUpdate > 60000) { // هر ۶۰ ثانیه تغییر کن
    currentMorph = {
      ...currentMorph,
      tlsFingerprint: ['chrome', 'firefox', 'safari', 'random'][Math.floor(Math.random() * 4)] as any,
      dynamicTTL: Math.random() > 0.5
    };
    lastUpdate = now;
  }
  return currentMorph;
}

// ==================== اعمال مورف روی هدرها ====================
export function applyMorphToHeaders(headers: Headers): Headers {
  const config = getMorphConfig();
  const newHeaders = new Headers(headers);

  if (config.morphEnabled) {
    // تغییر TTL (در هدر سفارشی)
    if (config.dynamicTTL) {
      const ttl = Math.floor(Math.random() * 128) + 64;
      newHeaders.set('X-TTL', ttl.toString());
    }

    // تغییر User-Agent با Fragment
    const ua = headers.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    if (config.fragmentEnabled) {
      const frag = `; ${Math.random().toString(36).substring(2, 8)}`;
      newHeaders.set('User-Agent', ua + frag);
    }

    // شبیه‌سازی اثرانگشت TLS
    if (config.tlsFingerprint !== 'random') {
      const fp = getTLSFingerprint(config.tlsFingerprint);
      newHeaders.set('X-TLS-Fingerprint', fp);
    }
  }

  return newHeaders;
}

// ==================== دریافت اثرانگشت TLS ====================
function getTLSFingerprint(browser: string): string {
  const fingerprints: Record<string, string> = {
    'chrome': 'chrome-121',
    'firefox': 'firefox-124',
    'safari': 'safari-17'
  };
  return fingerprints[browser] || 'chrome-121';
}

// ==================== دریافت تنظیمات Fragment ====================
export function getFragmentConfig(): string {
  const size = Math.floor(Math.random() * 200) + 50;
  const count = Math.floor(Math.random() * 5) + 2;
  return `${size}:${count}`;
}
