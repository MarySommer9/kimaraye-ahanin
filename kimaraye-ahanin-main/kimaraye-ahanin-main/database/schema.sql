-- جدول کاربران
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    uuid TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    protocol TEXT DEFAULT 'vless' CHECK (protocol IN ('vless', 'trojan', 'shadowsocks', 'reality', 'hysteria2', 'tuic')),
    quota REAL DEFAULT 10,
    used REAL DEFAULT 0,
    expires_at INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    is_active INTEGER DEFAULT 1,
    allowed_ips TEXT,
    remark TEXT
);

-- جدول تنظیمات
CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- درج کاربر پیش‌فرض
INSERT OR IGNORE INTO users (id, username, uuid, password, protocol, quota, expires_at, is_active, remark)
VALUES ('admin', 'admin', 'b831d5e8-9c7d-4b3e-a5f1-8e7d6c5b4a3f', 'Chameleon@2026', 'vless', 0, 0, 1, 'Administrator');

-- درج توکن ادمین در config
INSERT OR IGNORE INTO config (key, value) VALUES ('admin_token', 'admin123');
