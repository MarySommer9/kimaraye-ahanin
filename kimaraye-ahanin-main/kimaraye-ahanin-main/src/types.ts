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
  protocol: 'vless' | 'trojan' | 'shadowsocks' | 'reality' | 'hysteria2' | 'tuic';
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

// ==================== Health Check ====================
export interface CheckResult {
  ok:        boolean;
  latencyMs: number;
  message:   string;
}

export interface HealthStatus {
  status:    'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  version:   string;
  checks: {
    database: CheckResult;
    kv:       CheckResult;
    runtime:  CheckResult;
  };
  summary: string;
}

// ==================== Domain Rotator ====================
export interface SubdomainRecord {
  subdomain:  string;
  fqdn:       string;
  cfRecordId: string;
  createdAt:  number;
  expiresAt:  number;
}

export interface DomainRotatorConfig {
  zoneId:        string;
  apiToken:      string;
  baseDomain:    string;
  targetIP:      string;
  prefixes:      string[];
  ttlSeconds:    number;
  maxSubdomains: number;
}

// ==================== Telegram ====================
export interface TelegramConfig {
  botToken: string;
  chatId:   string;
}
