// ============================================
// 🦁 کیمارای آهنین - ربات تلگرام
// ============================================
// ربات تلگرام برای دریافت کانفیگ خودکار
// دستورات: /start، /config، /help، /status

import { Env } from '../types';
import { authenticateUser, createUser, listUsers } from './auth';
import { buildHysteria2URI } from './protocols/hysteria2';
import { buildTUICURI }      from './protocols/tuic';
import { getCurrentEchConfig } from './ech';
import { runHealthChecks }     from './health';

// ==================== تایپ‌های تلگرام ====================
interface TelegramUpdate {
  update_id: number;
  message?:  TelegramMessage;
}

interface TelegramMessage {
  message_id: number;
  from?:      { id: number; username?: string; first_name?: string };
  chat:       { id: number; type: string };
  text?:      string;
}

// ==================== هندلر اصلی Webhook ====================
export async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
  // بررسی توکن Webhook (امنیت)
  const webhookSecret = await env.KV.get('telegram_webhook_secret');
  if (webhookSecret) {
    const headerSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (headerSecret !== webhookSecret) {
      return new Response('Forbidden', { status: 403 });
    }
  }

  let update: TelegramUpdate;
  try {
    update = await request.json() as TelegramUpdate;
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const message = update.message;
  if (!message || !message.text) return new Response('OK');

  // اجرای async بدون منتظر ماندن (برای پاسخ سریع به Telegram)
  const botToken = await env.KV.get('telegram_bot_token');
  if (!botToken) return new Response('OK');

  await processMessage(env, botToken, message);
  return new Response('OK');
}

// ==================== پردازش پیام ====================
async function processMessage(env: Env, botToken: string, msg: TelegramMessage): Promise<void> {
  const chatId = msg.chat.id;
  const text   = (msg.text || '').trim();
  const userId = msg.from?.id;

  // بررسی دسترسی (اختیاری — فقط اگر telegram_allowed_users تنظیم شده باشد)
  const allowedUsers = await env.KV.get('telegram_allowed_users');
  if (allowedUsers && userId) {
    const allowed = allowedUsers.split(',').map(s => s.trim());
    if (!allowed.includes(String(userId)) && !allowed.includes(msg.from?.username || '')) {
      await sendMessage(botToken, chatId, '⛔ شما اجازه استفاده از این ربات را ندارید.');
      return;
    }
  }

  const firstName = msg.from?.first_name || 'کاربر';

  // ---------- دستورات ----------
  if (text.startsWith('/start')) {
    await sendMessage(botToken, chatId, buildStartMessage(firstName));
    return;
  }

  if (text.startsWith('/help')) {
    await sendMessage(botToken, chatId, buildHelpMessage());
    return;
  }

  if (text.startsWith('/status')) {
    await handleStatusCommand(env, botToken, chatId);
    return;
  }

  if (text.startsWith('/config')) {
    const parts = text.split(' ');
    const uuid  = parts[1]?.trim();
    await handleConfigCommand(env, botToken, chatId, uuid, msg);
    return;
  }

  if (text.startsWith('/newuser')) {
    const parts    = text.split(' ');
    const username = parts[1]?.trim() || `tg_${userId}_${Date.now()}`;
    await handleNewUserCommand(env, botToken, chatId, username, userId);
    return;
  }

  if (text.startsWith('/users') && await isAdmin(env, userId)) {
    await handleUsersCommand(env, botToken, chatId);
    return;
  }

  if (text.startsWith('/setworker')) {
    // کاربر آدرس Worker خود را ارسال می‌کند
    const workerUrl = text.replace('/setworker', '').trim();
    if (workerUrl && workerUrl.startsWith('https://')) {
      await env.KV.put(`user_worker:${userId}`, workerUrl, { expirationTtl: 86400 * 30 });
      await sendMessage(botToken, chatId, `✅ آدرس Worker شما ذخیره شد:\n\`${workerUrl}\`\n\nاکنون از /config استفاده کنید تا کانفیگ خود را دریافت کنید.`);
    } else {
      await sendMessage(botToken, chatId, '❌ آدرس Worker نامعتبر است.\nمثال: `/setworker https://my-worker.workers.dev`');
    }
    return;
  }

  // اگر دستور ناشناخته باشد
  await sendMessage(botToken, chatId, `❓ دستور ناشناخته.\nبرای راهنما /help را ارسال کنید.`);
}

// ==================== هندلر دستورات ====================

async function handleConfigCommand(
  env: Env, botToken: string, chatId: number,
  uuid: string | undefined, msg: TelegramMessage
): Promise<void> {
  const userId = msg.from?.id;

  // دریافت Worker URL کاربر
  const workerUrl = userId ? await env.KV.get(`user_worker:${userId}`) : null;
  const host      = workerUrl ? new URL(workerUrl).host : 'your-worker.workers.dev';

  let user = null;

  if (uuid) {
    user = await authenticateUser(env, uuid);
  } else if (userId) {
    // جستجو با telegram_id
    const savedUUID = await env.KV.get(`tg_uuid:${userId}`);
    if (savedUUID) user = await authenticateUser(env, savedUUID);
  }

  if (!user) {
    await sendMessage(botToken, chatId,
      '❌ کاربری یافت نشد.\n' +
      'از /newuser برای ساخت کاربر جدید استفاده کنید.\n' +
      'یا UUID خود را به این شکل ارسال کنید:\n`/config YOUR-UUID`'
    );
    return;
  }

  const echConf = await getCurrentEchConfig(env);
  const links   = buildAllLinks(user, host, echConf);

  // ارسال پیام اصلی
  await sendMessage(botToken, chatId, buildConfigMessage(user, host, links, workerUrl));

  // ارسال لینک‌های ساب‌اسکریپشن به‌صورت جداگانه
  if (host !== 'your-worker.workers.dev') {
    await sendMessage(botToken, chatId, buildSubscriptionLinks(user, host));
  }
}

async function handleNewUserCommand(
  env: Env, botToken: string, chatId: number,
  username: string, telegramId: number | undefined
): Promise<void> {
  try {
    const newUser = await createUser(env, {
      username,
      protocol: 'vless',
      quota:    10,
      expires_at: Date.now() + 30 * 86400000, // ۳۰ روز
      remark:   telegramId ? `Telegram ID: ${telegramId}` : 'از ربات تلگرام',
    });

    // ذخیره ارتباط UUID با Telegram ID
    if (telegramId) {
      await env.KV.put(`tg_uuid:${telegramId}`, newUser.uuid, { expirationTtl: 86400 * 30 });
    }

    await sendMessage(botToken, chatId,
      `✅ کاربر جدید ساخته شد!\n\n` +
      `👤 نام: \`${newUser.username}\`\n` +
      `🔑 UUID: \`${newUser.uuid}\`\n` +
      `🔒 رمز: \`${newUser.password}\`\n` +
      `📦 سهمیه: ۱۰ گیگابایت (۳۰ روزه)\n\n` +
      `برای دریافت کانفیگ: /config\n` +
      `ابتدا Worker خود را با /setworker تنظیم کنید.`
    );
  } catch (err: any) {
    await sendMessage(botToken, chatId, `❌ خطا: ${err.message}`);
  }
}

async function handleStatusCommand(env: Env, botToken: string, chatId: number): Promise<void> {
  try {
    const health = await runHealthChecks(env);
    const icon   = health.status === 'healthy' ? '✅' : health.status === 'degraded' ? '⚠️' : '❌';

    const checks = Object.entries(health.checks)
      .map(([k, v]) => `${v.ok ? '✅' : '❌'} ${checkLabel(k)}: ${v.message}`)
      .join('\n');

    await sendMessage(botToken, chatId,
      `${icon} *وضعیت سرویس کیمارای آهنین*\n\n` +
      `📊 وضعیت کلی: *${health.status.toUpperCase()}*\n\n` +
      `${checks}\n\n` +
      `🕐 ${new Date(health.timestamp).toLocaleString('fa-IR')}`
    );
  } catch (err: any) {
    await sendMessage(botToken, chatId, `❌ خطا در دریافت وضعیت: ${err.message}`);
  }
}

async function handleUsersCommand(env: Env, botToken: string, chatId: number): Promise<void> {
  try {
    const users = await listUsers(env, 20);
    if (users.length === 0) {
      await sendMessage(botToken, chatId, '📭 هیچ کاربری وجود ندارد.');
      return;
    }

    const lines = users.map((u, i) =>
      `${i + 1}. *${u.username}* | ${u.protocol.toUpperCase()} | ${(u.used || 0).toFixed(1)}/${u.quota}GB`
    );

    await sendMessage(botToken, chatId,
      `👥 *لیست کاربران (${users.length})*\n\n` + lines.join('\n')
    );
  } catch (err: any) {
    await sendMessage(botToken, chatId, `❌ خطا: ${err.message}`);
  }
}

// ==================== ساخت پیام‌ها ====================

function buildStartMessage(firstName: string): string {
  return (
    `🦁 *سلام ${firstName} عزیز!*\n\n` +
    `به ربات *کیمارای آهنین* خوش آمدید.\n` +
    `این ربات کانفیگ‌های اتصال شما را بهصورت خودکار می‌سازد.\n\n` +
    `📌 *مراحل شروع:*\n` +
    `۱. آدرس Worker خود را با /setworker تنظیم کنید\n` +
    `۲. با /newuser یک کاربر بسازید\n` +
    `۳. با /config کانفیگ‌های خود را دریافت کنید\n\n` +
    `برای راهنما: /help`
  );
}

function buildHelpMessage(): string {
  return (
    `📖 *راهنمای ربات کیمارای آهنین*\n\n` +
    `🔹 /start — شروع و معرفی\n` +
    `🔹 /setworker [آدرس] — تنظیم آدرس Worker\n` +
    `  مثال: \`/setworker https://my.workers.dev\`\n\n` +
    `🔹 /newuser [نام] — ساخت کاربر جدید\n` +
    `  مثال: \`/newuser ali_123\`\n\n` +
    `🔹 /config [uuid] — دریافت کانفیگ\n` +
    `  یا فقط /config برای کانفیگ پیش‌فرض\n\n` +
    `🔹 /status — بررسی وضعیت سرویس\n` +
    `🔹 /help — این راهنما\n\n` +
    `📱 *کلاینت‌های پشتیبانی‌شده:*\n` +
    `• Sing-box (توصیه شده)\n` +
    `• Clash Meta / Mihomo\n` +
    `• V2RayNG، V2RayN\n` +
    `• Hiddify Next\n` +
    `• Streisand`
  );
}

function buildConfigMessage(user: any, host: string, links: Record<string, string>, workerUrl: string | null): string {
  const hasWorker = host !== 'your-worker.workers.dev';

  let msg = `🦁 *کانفیگ کاربر ${user.username}*\n\n`;

  if (!hasWorker) {
    msg += `⚠️ ابتدا Worker خود را تنظیم کنید:\n/setworker https\://your.workers.dev\n\n`;
  }

  msg += `📊 مصرف: \`${(user.used || 0).toFixed(2)} / ${user.quota || '∞'} GB\`\n\n`;
  msg += `━━━━━━━━━━━━━━━━\n`;

  if (hasWorker) {
    msg += `\n⚡ *VLESS+WS+TLS:*\n\`\`\`\n${links.vless}\n\`\`\`\n`;
    if (links.reality) msg += `\n💎 *VLESS+Reality:*\n\`\`\`\n${links.reality}\n\`\`\`\n`;
    msg += `\n🛡️ *Trojan+WS:*\n\`\`\`\n${links.trojan}\n\`\`\`\n`;
    msg += `\n🌑 *Shadowsocks:*\n\`\`\`\n${links.shadowsocks}\n\`\`\`\n`;
    msg += `\n⚡ *Hysteria2:*\n\`\`\`\n${links.hysteria2}\n\`\`\`\n`;
    msg += `\n🚀 *TUIC v5:*\n\`\`\`\n${links.tuic}\n\`\`\`\n`;
  } else {
    msg += `\n_پس از تنظیم Worker، لینک‌ها نمایش داده می‌شوند._`;
  }

  return msg;
}

function buildSubscriptionLinks(user: any, host: string): string {
  return (
    `📥 *لینک‌های ساب‌اسکریپشن:*\n\n` +
    `🔵 Sing-box:\n\`https://${host}/sub?uuid=${user.uuid}&format=singbox\`\n\n` +
    `🟠 Clash Meta:\n\`https://${host}/sub?uuid=${user.uuid}&format=clash\`\n\n` +
    `⚪ V2Ray/Xray:\n\`https://${host}/sub?uuid=${user.uuid}&format=v2ray&output=text\`\n\n` +
    `📌 این لینک را در کلاینت خود import کنید.`
  );
}

function buildAllLinks(user: any, host: string, echConf: any): Record<string, string> {
  const name = encodeURIComponent(`Kimaraye-${user.username}`);

  const vless = `vless://${user.uuid}@${host}:443?` + new URLSearchParams({
    encryption: 'none', security: 'tls', sni: host, fp: 'chrome',
    type: 'ws', host, path: `/proxy/vless?uuid=${user.uuid}&ed=2048`,
  }) + `#${name}-VLESS`;

  const trojan = `trojan://${encodeURIComponent(user.password)}@${host}:443?` + new URLSearchParams({
    security: 'tls', sni: host, fp: 'chrome', type: 'ws',
    host, path: `/proxy/trojan?uuid=${user.uuid}&ed=2048`,
  }) + `#${name}-Trojan`;

  const ssUserInfo = btoa(`chacha20-ietf-poly1305:${user.password}`).replace(/=+$/, '');
  const shadowsocks = `ss://${ssUserInfo}@${host}:443/?plugin=${encodeURIComponent(`v2ray-plugin;tls;host=${host};path=/proxy/shadowsocks?password=${encodeURIComponent(user.password)}&ed=2048`)}#${name}-SS`;

  return {
    vless,
    trojan,
    shadowsocks,
    hysteria2:   buildHysteria2URI(user, host),
    tuic:        buildTUICURI(user, host),
    reality:     '', // اگر key وجود داشته باشد بعداً پر می‌شود
  };
}

// ==================== توابع کمکی ====================

async function sendMessage(botToken: string, chatId: number, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id:    chatId,
      text:       text.slice(0, 4096),  // محدودیت تلگرام
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }),
  });
}

async function isAdmin(env: Env, telegramId: number | undefined): Promise<boolean> {
  if (!telegramId) return false;
  const adminIds = await env.KV.get('telegram_admin_ids');
  if (!adminIds) return true; // اگر تنظیم نشده، همه admin هستند
  return adminIds.split(',').map(s => s.trim()).includes(String(telegramId));
}

function checkLabel(key: string): string {
  return { database: 'دیتابیس', kv: 'KV Cache', runtime: 'Runtime' }[key] || key;
}

// ==================== ثبت Webhook ====================
/**
 * Webhook ربات تلگرام را روی آدرس Worker ثبت می‌کند.
 * فقط یک‌بار اجرا شود.
 */
export async function registerTelegramWebhook(request: Request, env: Env): Promise<Response> {
  const adminToken = await env.KV.get('admin_token') || 'admin123';
  const token      = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token || token !== adminToken) return new Response('Unauthorized', { status: 401 });

  const botToken = await env.KV.get('telegram_bot_token');
  if (!botToken) {
    return new Response(JSON.stringify({ error: 'telegram_bot_token در KV تنظیم نشده' }), {
      status:  503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const host          = request.headers.get('host') || 'localhost';
  const webhookSecret = crypto.randomUUID().replace(/-/g, '');
  const webhookUrl    = `https://${host}/telegram/webhook`;

  await env.KV.put('telegram_webhook_secret', webhookSecret);

  const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url:          webhookUrl,
      secret_token: webhookSecret,
      allowed_updates: ['message'],
      drop_pending_updates: true,
    }),
  });

  const data = await res.json() as any;

  return new Response(JSON.stringify({
    success:    data.ok,
    webhookUrl,
    message:    data.ok ? '✅ Webhook با موفقیت ثبت شد' : `❌ ${data.description}`,
  }), {
    status:  data.ok ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  });
}
