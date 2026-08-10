# 🦁 کیمارای آهنین (Iron Chimera)

> **پروکسی ضد‌فیلتر پیشرفته روی Cloudflare Workers**  
> پشتیبانی از پروتکل‌های VLESS، Trojan، Shadowsocks، Reality، **Hysteria2** و **TUIC v5** با لایه‌های امنیتی هوشمند

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/MarySommer9/kimaraye-ahanin)

---

## ✨ قابلیت‌ها

- ✅ **بدون نیاز به سرور اختصاصی** – همه‌چیز روی زیرساخت Cloudflare Workers اجرا می‌شود
- ✅ **۶ پروتکل هم‌زمان** – VLESS، Trojan، Shadowsocks، Reality (X25519)، **Hysteria2** و **TUIC v5**
- ✅ **لایه‌های امنیتی پیشرفته**:
  - **ECH** (Encrypted Client Hello) – رمزنگاری SNI در TLS 1.3
  - **Morph** – تغییر پویای پارامترهای TLS/MTU/TTL
  - **Decoy** – لایه‌ی دامی برای مخفی‌سازی ترافیک
  - **Fragment** – تکه‌تکه‌سازی هدرها برای فرار از DPI
  - **TLS Fingerprint** – شبیه‌سازی اثرانگشت مرورگرهای واقعی
- ✅ **مدیریت کامل کاربران** – احراز هویت، سهمیه‌بندی (Quota)، تاریخ انقضا، فعال/غیرفعال‌سازی
- ✅ **ساب‌اسکریپشن اختصاصی** – خروجی آماده برای Sing-box، Clash (Meta) و V2Ray (با ECH)
- ✅ **پنل مدیریت Alpine.js** – جستجو، مرتب‌سازی، صفحه‌بندی، آمار لحظه‌ای، ECH و تلگرام
- ✅ **ربات تلگرام** – دریافت خودکار کانفیگ، ساخت کاربر، و نمایش وضعیت سرویس
- ✅ **Health Check** – مانیتورینگ DB، KV و Runtime با هشدار تلگرام
- ✅ **چرخش خودکار دامنه** – ایجاد ساب‌دامین‌های تصادفی هر ۲۴ ساعت با Cloudflare API
- ✅ **مقیاس‌پذیری داخلی** – توزیع بار بین چند Worker
- ✅ **کاملاً رایگان** – تا ۱۰۰٬۰۰۰ درخواست در روز (سقف رایگان Cloudflare)


---

## 📋 پیش‌نیازها

- یک حساب [Cloudflare](https://dash.cloudflare.com/) (سطح رایگان کافی است)
- Node.js نسخه‌ی ۱۶ یا بالاتر
- آشنایی اولیه با خط فرمان و مفاهیم Workers

---

## 🚀 نصب و راه‌اندازی

### ۱. دریافت کد پروژه

```bash
git clone https://github.com/MarySommer9/kimaaraye-ahani.git
cd kimaaraye-ahani
```

### ۲. نصب وابستگی‌ها

```bash
npm install
```

### ۳. ایجاد دیتابیس D1

```bash
npx wrangler d1 create kimaaraye-ahani-db
```

شناسه‌ی دیتابیس را کپی کرده و در فایل `wrangler.jsonc` به‌جای `YOUR_DATABASE_ID` قرار دهید.

### ۴. ایجاد KV Namespace

```bash
npx wrangler kv:namespace create "KV"
```

شناسه را کپی کرده و در `wrangler.jsonc` به‌جای `YOUR_KV_ID` قرار دهید.

### ۵. ایجاد R2 Bucket (اختیاری – برای ذخیره‌ی لاگ‌ها)

```bash
npx wrangler r2 bucket create kimaaraye-ahani-logs
```

نام و شناسه‌ی bucket را در `wrangler.jsonc` تنظیم کنید.

### ۶. اجرای Schema دیتابیس

```bash
npx wrangler d1 execute kimaaraye-ahani-db --file=./database/schema.sql
```

### ۷. تنظیم توکن ادمین در KV

```bash
npx wrangler kv:key put --binding=KV "admin_token" "admin123"
```

> **توجه:** توکن پیش‌فرض را حتماً به یک مقدار امن تغییر دهید.

### ۸. استقرار روی Cloudflare

```bash
npm run deploy
```

یا با استفاده از دکمه‌ی زیر:

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/button)

---

## 📱 نحوه‌ی استفاده

### دریافت لینک‌های اتصال

پس از دیپلوی، آدرس Worker خود را (مثلاً `https://kimaaraye-ahani.workers.dev`) در مرورگر باز کنید و UUID کاربر را به‌صورت پارامتر `uuid` به آن اضافه کنید:

```text
https://[worker-address]/sub?uuid=b831d5e8-9c7d-4b3e-a5f1-8e7d6c5b4a3f
```

### لینک‌های نمونه

#### VLESS

```text
vless://b831d5e8-9c7d-4b3e-a5f1-8e7d6c5b4a3f@[worker-address]:443?encryption=none&security=tls&sni=[worker-address]&fp=randomized&type=ws&host=[worker-address]&path=%2Fproxy%2Fvless%3Fuuid%3Db831d5e8-9c7d-4b3e-a5f1-8e7d6c5b4a3f%26ed%3D2048#Kimaaraye
```

#### Trojan

```text
trojan://Chameleon@2026@[worker-address]:443?security=tls&sni=[worker-address]&fp=randomized&type=ws&host=[worker-address]&path=%2Fproxy%2Ftrojan%3Fuuid%3Db831d5e8-9c7d-4b3e-a5f1-8e7d6c5b4a3f%26ed%3D2048#Kimaaraye
```

#### Shadowsocks

```text
ss://Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTpDaGFtZWxlb24tMjAyNg@[worker-address]:443/?plugin=v2ray-plugin%3Bpath%3D%252Fproxy%252Fshadowsocks%253Fpassword%253DChameleon%25402026%26ed%3D2048%26host%3D[worker-address]%26tls#Kimaaraye
```

> جای `[worker-address]` را با آدرس واقعی Worker خود جایگزین کنید.

---

## 🖥️ پنل مدیریت

پنل مدیریت در آدرس زیر در دسترس است:

```text
https://[worker-address]/admin
```

توکن پیش‌فرض ادمین: `admin123`  
(پس از اولین ورود حتماً آن را تغییر دهید)

---

## 🧠 ساختار پروژه

```text
kimaaraye-ahani/
├── src/
│   ├── index.ts                 # نقطه‌ی ورودی اصلی
│   ├── core/
│   │   ├── auth.ts              # احراز هویت و مدیریت کاربران
│   │   ├── admin-panel.ts       # پنل مدیریت (API)
│   │   ├── load-balancer.ts     # توزیع بار بین Workerها
│   │   ├── router.ts            # مسیر‌یابی درخواست‌ها
│   │   ├── protocols/
│   │   │   ├── vless.ts         # پیاده‌سازی VLESS
│   │   │   ├── trojan.ts        # پیاده‌سازی Trojan
│   │   │   ├── shadowsocks.ts   # پیاده‌سازی Shadowsocks (AEAD)
│   │   │   └── reality.ts       # پیاده‌سازی Reality (X25519)
│   │   ├── security/
│   │   │   ├── morph.ts         # موتور تغییر پارامترها (TLS/MTU/TTL)
│   │   │   ├── decoy.ts         # لایه‌ی دامی
│   │   │   ├── fragment.ts      # تکه‌تکه‌سازی هدرها
│   │   │   └── tls-fingerprint.ts # شبیه‌سازی اثرانگشت TLS
│   │   ├── transport/
│   │   │   ├── websocket.ts     # WebSocket با Fragment
│   │   │   ├── grpc.ts          # gRPC (Cloudflare gRPC)
│   │   │   └── http2.ts         # HTTP/2 با Alt-Svc
│   │   └── subscription/
│   │       ├── index.ts         # نقطه‌ی ورودی ساب‌اسکریپشن
│   │       ├── singbox.ts       # خروجی Sing-box
│   │       ├── clash.ts         # خروجی Clash (Meta)
│   │       └── v2ray.ts         # خروجی V2Ray (JSON)
│   ├── utils/
│   │   ├── crypto.ts            # توابع رمزنگاری (XChaCha20, AES-GCM)
│   │   ├── db.ts                # توابع پیشرفته‌ی D1 با کش KV
│   │   └── logger.ts            # لاگ‌گیری با ذخیره‌سازی در R2
│   ├── types.ts                 # تعاریف تایپ‌های عمومی
│   └── config.ts                # تنظیمات مرکزی
├── database/
│   ├── schema.sql               # ساختار کامل دیتابیس
│   └── migrations/              # پوشه‌ی مهاجرت‌ها
├── public/
│   ├── index.html               # صفحه‌ی پنل مدیریت (SPA)
│   ├── css/style.css
│   └── js/app.js
├── LICENSE                      # مجوز MIT
├── README.md
├── package.json
├── tsconfig.json
└── wrangler.jsonc               # تنظیمات Cloudflare (D1, KV, R2, Workers)
```

---

## 📖 راهنمای کاربری

### ورود به پنل مدیریت

۱. آدرس Worker خود را در مرورگر باز کنید: `https://[worker].workers.dev/admin`
۲. توکن ادمین را وارد کنید (پیش‌فرض: `admin123` — **حتماً تغییر دهید!**)
۳. پس از ورود، داشبورد اصلی با آمار لحظه‌ای نمایش داده می‌شود.

### افزودن کاربر جدید

۱. در پنل مدیریت به بخش **«کاربران»** بروید.
۲. روی دکمه **«+ کاربر جدید»** کلیک کنید.
۳. فیلدهای زیر را پر کنید:
   - **نام کاربری**: یک نام یکتا (مثال: `user_ali`)
   - **پروتکل**: VLESS، Trojan، Shadowsocks یا Reality
   - **سهمیه (GB)**: ۰ به معنی نامحدود است
   - **انقضا**: تعداد روز از امروز (۰ = نامحدود)
۴. پس از ثبت، UUID و رمز عبور بهصورت خودکار تولید می‌شوند.

### دریافت لینک اشتراک کاربر

- از آیکون 🔗 در ستون عملیات کاربر استفاده کنید تا لینک ساب‌اسکریپشن کپی شود.
- کاربر می‌تواند این لینک را مستقیماً در Sing-box، Clash یا V2Ray وارد کند.

### فرمت‌های ساب‌اسکریپشن

| فرمت     | URL                              |
|----------|----------------------------------|
| Text     | `/sub?uuid=UUID`                 |
| Sing-box | `/sub?uuid=UUID&format=singbox`  |
| Clash    | `/sub?uuid=UUID&format=clash`    |
| V2Ray    | `/sub?uuid=UUID&format=v2ray`    |

### تنظیم هشدار تلگرام

برای دریافت هشدار در صورت بروز مشکل در سرویس:

```bash
# ذخیره توکن ربات تلگرام در KV
npx wrangler kv:key put --binding=KV "telegram_bot_token" "YOUR_BOT_TOKEN"

# ذخیره Chat ID در KV
npx wrangler kv:key put --binding=KV "telegram_chat_id" "YOUR_CHAT_ID"
```

### تنظیم چرخش خودکار دامنه

```bash
# Zone ID دامنه در Cloudflare
npx wrangler kv:key put --binding=KV "domain_rotator_zone_id" "YOUR_ZONE_ID"

# API Token (نیاز به دسترسی Edit DNS دارد)
npx wrangler kv:key put --binding=KV "domain_rotator_token" "YOUR_CF_API_TOKEN"

# دامنه اصلی
npx wrangler kv:key put --binding=KV "domain_rotator_base_domain" "example.com"

# IP یا CNAME هدف
npx wrangler kv:key put --binding=KV "domain_rotator_target_ip" "YOUR_WORKER_IP"
```

پس از تنظیم، از پنل مدیریت به بخش **«چرخش دامنه»** بروید و **«چرخش اجباری»** را اجرا کنید.

---

### 🚀 تنظیم Hysteria2 (پروتکل UDP سرعت بالا)

Hysteria2 یک پروتکل مبتنی بر QUIC است که سرعت و مقاومت بالاتری در برابر DPI دارد.

**تنظیم Backend (اختیاری — بدون Backend در حالت WebSocket کار می‌کند):**

```bash
# آدرس سرور Hysteria2 شما (اگر دارید)
npx wrangler kv:key put --binding=KV "hysteria2_backend" "1.2.3.4:443"
```

**لینک Hysteria2 برای کلاینت:**
```
hysteria2://UUID@your.workers.dev:443?obfs=salamander&obfs-password=XXXXXXXX&sni=your.workers.dev
```

**تنظیم در Sing-box:** از `/sub?uuid=UUID&format=singbox` استفاده کنید. کانفیگ کامل با Hysteria2 به‌صورت خودکار تولید می‌شود.

---

### 🌊 تنظیم TUIC v5 (پروتکل QUIC با Multiplexing)

TUIC v5 از multiplexing و 0-RTT پشتیبانی می‌کند و برای ترافیک سنگین مناسب است.

```bash
# آدرس سرور TUIC شما (اختیاری)
npx wrangler kv:key put --binding=KV "tuic_backend" "1.2.3.4:443"
```

**لینک TUIC برای کلاینت:**
```
tuic://UUID:PASSWORD@your.workers.dev:443?sni=your.workers.dev&congestion-controller=bbr&udp-relay-mode=native&alpn=h3
```

---

### 🔐 تنظیم ECH (Encrypted Client Hello)

ECH نام دامنه (SNI) را در TLS 1.3 رمزنگاری می‌کند تا از شناسایی مقصد جلوگیری کند.

**مراحل فعال‌سازی:**

۱. در پنل مدیریت به بخش **«مدیریت ECH»** بروید
۲. روی **«تولید کلید جدید»** کلیک کنید — کلید با انقضای ۲۴ ساعت ساخته می‌شود
۳. کانفیگ Sing-box به‌صورت خودکار از `/ech/config` دریافت می‌کند

یا از طریق API:
```bash
# تولید کلید ECH (نیاز به توکن ادمین)
curl -X POST https://your.workers.dev/ech/keygen \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# دریافت کانفیگ ECH عمومی
curl https://your.workers.dev/ech/config
```

---

### 🤖 تنظیم ربات تلگرام

ربات تلگرام به کاربران اجازه می‌دهد بدون نیاز به پنل مدیریت، کانفیگ دریافت کنند.

**مراحل راه‌اندازی:**

```bash
# ۱. توکن ربات از @BotFather
npx wrangler kv:key put --binding=KV "telegram_bot_token" "1234567890:AAF..."

# ۲. (اختیاری) محدود کردن دسترسی
npx wrangler kv:key put --binding=KV "telegram_allowed_users" "123456789,user2"

# ۳. (اختیاری) ادمین‌های ربات
npx wrangler kv:key put --binding=KV "telegram_admin_ids" "123456789"
```

سپس از پنل مدیریت بخش **«ربات تلگرام»** روی «ثبت Webhook» کلیک کنید.

**دستورات ربات:**

| دستور | توضیح |
|-------|-------|
| `/start` | معرفی و شروع |
| `/setworker https://...` | تنظیم آدرس Worker |
| `/newuser ali_123` | ساخت کاربر جدید |
| `/config` | دریافت همه لینک‌ها و ساب‌اسکریپشن |
| `/status` | بررسی سلامت سرویس |
| `/users` | لیست کاربران (فقط ادمین) |

---

## 🔧 عیب‌یابی

### مشکل: خطای `401 Unauthorized` در پنل مدیریت

**علت**: توکن ادمین اشتباه است.  
**راهحل**:
```bash
# مقدار فعلی توکن را بررسی کنید:
npx wrangler kv:key get --binding=KV "admin_token"

# توکن جدید تنظیم کنید:
npx wrangler kv:key put --binding=KV "admin_token" "NEW_SECURE_TOKEN"
```

---

### مشکل: خطای `500` یا پیام «خطای دیتابیس»

**علت**: دیتابیس D1 اجرا نشده یا Schema نصب نشده است.  
**راهحل**:
```bash
# بررسی وجود دیتابیس
npx wrangler d1 list

# اجرای دوباره Schema
npx wrangler d1 execute kimaraye-ahanin-db --file=./database/schema.sql
```

---

### مشکل: کاربران بارگذاری نمی‌شوند

**راهحل**:
1. به آدرس `/health` در مرورگر بروید و وضعیت DB و KV را بررسی کنید.
2. لاگ‌های Worker را در داشبورد Cloudflare بررسی کنید.
3. از صحت مقادیر `database_id` و KV `id` در `wrangler.jsonc` مطمئن شوید.

---

### مشکل: لینک‌های اشتراک کار نمی‌کنند

**علت**: SNI یا host نادرست است.  
**راهحل**:
- مطمئن شوید Worker روی دامنه‌ی custom deploy شده است (نه `workers.dev`).
- تنظیمات TLS در Cloudflare را روی **Full (strict)** قرار دهید.
- در کلاینت، `sni` را برابر با آدرس Worker تنظیم کنید.

---

### مشکل: خطای `TypeError: Cannot read properties of undefined`

**علت**: فایل `wrangler.jsonc` ناقص است.  
**راهحل**: مطمئن شوید که `YOUR_DATABASE_ID` و `YOUR_KV_ID` با مقادیر واقعی جایگزین شده‌اند:
```bash
npx wrangler d1 list   # برای یافتن database_id
npx wrangler kv list   # برای یافتن KV id
```

---

### بررسی وضعیت سلامت سرویس (Health Check)

```bash
# از طریق مرورگر
curl https://[worker].workers.dev/health

# با جزئیات ادمین
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://[worker].workers.dev/admin/api/health
```

پاسخ نمونه موفق:
```json
{
  "status": "healthy",
  "checks": {
    "database": { "ok": true, "latencyMs": 12, "message": "D1 سالم است — ۵ کاربر در دیتابیس" },
    "kv":       { "ok": true, "latencyMs":  8, "message": "KV سالم است — تأخیر 8ms" },
    "runtime":  { "ok": true, "latencyMs":  0, "message": "Runtime سالم — Web Crypto فعال" }
  },
  "summary": "سرویس سالم است — تمام 3 بررسی موفق بودند"
}
```

---

### بررسی لاگ‌های Worker

```bash
# اجرای Worker در حالت dev با لاگ زنده
npm run dev

# یا مشاهده لاگ‌های production
npx wrangler tail
```

---

## 🙏 تقدیر و تشکر

از پروژه‌های متن‌باز نهان، زئوس، نواپروکسی و BPB که ایده‌های ارزشمندشان در ساخت این پروژه الهام‌بخش بوده است، سپاسگزاریم.
همچنین از تمامی توسعه‌دهندگان و جامعه‌ی جهانی متن‌باز که با اشتراک دانش، امکان پیشرفت ابزارهای آزاد را فراهم می‌کنند، تشکر می‌کنیم.

**روحیه‌ی همکاری و آزادی اطلاعات، سرمایه‌ی مشترک همه‌ی ماست.** ❤️

---

## 📜 مجوز

این پروژه تحت مجوز **MIT** منتشر شده است. برای جزئیات بیشتر فایل `LICENSE` را مطالعه کنید.

---

## ⭐ حمایت

اگر این پروژه برای شما مفید بود، با **⭐ دادن** به ریپازیتوری و به اشتراک‌گذاری آن، از ما حمایت کنید.

---
