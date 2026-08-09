// ============================================
// 🦁 کیمارای آهنین - تعاریف تایپ‌ها
// ============================================

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
}

export interface User {
  id: string;
  username: string;
  uuid: string;
  password: string;
  protocol: 'vless' | 'trojan' | 'shadowsocks' | 'reality';
  quota: number;
  used: number;
  expires_at: number;
  created_at: number;
  is_active: number;
  allowed_ips?: string;
  remark?: string;
}

export interface SecurityLayer {
  morphEnabled: boolean;
  decoyEnabled: boolean;
  fragmentEnabled: boolean;
  tlsFingerprint: 'chrome' | 'firefox' | 'safari' | 'random';
  dynamicTTL: boolean;
}

export interface LoadBalancerConfig {
  workers: string[];
  strategy: 'round-robin' | 'random';
  healthCheckInterval: number;
}
