# 🦁 کیمارای آهنین (Iron Chimera)

> **پروکسی ضد‌فیلتر پیشرفته روی Cloudflare Workers**  
> پشتیبانی از پروتکل‌های VLESS، Trojan، Shadowsocks و Reality با لایه‌های امنیتی هوشمند

---

## ✨ قابلیت‌ها

- ✅ **بدون نیاز به سرور اختصاصی** – همه‌چیز روی زیرساخت Cloudflare Workers اجرا می‌شود
- ✅ **چندین پروتکل هم‌زمان** – VLESS، Trojan، Shadowsocks (AEAD) و Reality (X25519)
- ✅ **لایه‌های امنیتی پیشرفته**:
  - **Morph** – تغییر پویای پارامترهای TLS/MTU/TTL
  - **Decoy** – لایه‌ی دامی برای مخفی‌سازی ترافیک
  - **Fragment** – تکه‌تکه‌سازی هدرها برای فرار از DPI
  - **TLS Fingerprint** – شبیه‌سازی اثرانگشت مرورگرهای واقعی
- ✅ **مدیریت کامل کاربران** – احراز هویت، سهمیه‌بندی (Quota)، تاریخ انقضا، فعال/غیرفعال‌سازی
- ✅ **ساب‌اسکریپشن اختصاصی** – خروجی آماده برای Sing-box، Clash (Meta) و V2Ray
- ✅ **پنل مدیریت تحت وب** – رابط کاربری ساده برای مدیریت کاربران (React SPA)
- ✅ **مقیاس‌پذیری داخلی** – توزیع بار بین چند Worker با استراتژی‌های Round‑Robin، Random و Least‑Connections
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
