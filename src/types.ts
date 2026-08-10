// ============================================
// 🦁 کیمارای آهنین - تعاریف تایپ‌ها
// ============================================

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  ADMIN_TOKEN: string; // اختیاری برای fallback
  ENVIRONMENT: string;
}

export interface User {
  id: string;
  username: string;
  uuid: string;
  password: string;
  protocol: 'vless' | 'trojan' | 'shadowsocks' | 'reality' | 'hysteria2' | 'tuic';
  quota: number;
  used: number;
  expires_at: number;
  created_at: number;
  is_active: number;
  allowed_ips?: string;
  remark?: string;
}

// ... بقیه تایپ‌ها
