// ============================================
// 🦁 کیمارای آهنین - پنل مدیریت حرفه‌ای
// ============================================

import { Env, User } from '../types';
import { listUsers, createUser, updateUser, deleteUser } from './auth';

export async function adminAPI(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  // ===== احراز هویت =====
  const envToken = env.ADMIN_TOKEN;
  const kvToken = await env.KV?.get('admin_token');
  const expectedToken = envToken || kvToken || 'admin123';

  const authHeader = request.headers.get('Authorization');
  const queryToken = url.searchParams.get('token') || '';
  const token = authHeader?.replace('Bearer ', '') || queryToken || '';

  if (!token || token !== expectedToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  // ===== API ها =====
  if (url.pathname === '/admin/api/users' && request.method === 'GET') {
    const users = await listUsers(env);
    return Response.json(users);
  }

  if (url.pathname === '/admin/api/users' && request.method === 'POST') {
    try {
      const data = await request.json() as Partial<User>;
      const newUser = await createUser(env, data);
      return Response.json(newUser, { status: 201 });
    } catch {
      return Response.json({ error: 'Failed to create user' }, { status: 400 });
    }
  }

  if (url.pathname.startsWith('/admin/api/users/') && request.method === 'PUT') {
    const uuid = url.pathname.split('/').pop();
    if (!uuid) return Response.json({ error: 'Missing UUID' }, { status: 400 });
    try {
      const updates = await request.json() as Partial<User>;
      await updateUser(env, uuid, updates);
      return Response.json({ success: true });
    } catch {
      return Response.json({ error: 'Failed to update user' }, { status: 400 });
    }
  }

  if (url.pathname.startsWith('/admin/api/users/') && request.method === 'DELETE') {
    const uuid = url.pathname.split('/').pop();
    if (!uuid) return Response.json({ error: 'Missing UUID' }, { status: 400 });
    try {
      await deleteUser(env, uuid);
      return Response.json({ success: true });
    } catch {
      return Response.json({ error: 'Failed to delete user' }, { status: 400 });
    }
  }

  // ===== صفحه HTML =====
  return new Response(`<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>کیمارای آهنین · مدیریت</title>
  <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet" type="text/css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Vazirmatn', 'Segoe UI', Tahoma, sans-serif;
      background: #0b0b12;
      color: #e8e8f0;
      padding: 20px;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      direction: rtl;
    }
    .container {
      max-width: 1400px;
      width: 100%;
      background: rgba(16, 16, 28, 0.88);
      backdrop-filter: blur(10px);
      border-radius: 32px;
      padding: 28px 32px;
      border: 1px solid rgba(255, 204, 0, 0.07);
      box-shadow: 0 30px 70px rgba(0, 0, 0, 0.65);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #ffcc00;
      padding-bottom: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .logo {
      font-size: 28px;
      font-weight: 800;
      color: #ffcc00;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .logo span { color: #ffaa00; font-weight: 300; }
    .badge {
      background: rgba(0, 255, 100, 0.10);
      color: #0f0;
      padding: 6px 20px;
      border-radius: 40px;
      font-size: 13px;
      border: 1px solid rgba(0, 255, 100, 0.12);
    }
    .token-bar {
      background: rgba(255, 204, 0, 0.05);
      border: 1px solid rgba(255, 204, 0, 0.10);
      border-radius: 16px;
      padding: 12px 20px;
      margin-bottom: 22px;
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      font-size: 14px;
      color: #c0c0d0;
    }
    .token-bar strong { color: #ffcc00; }
    .token-bar .token-value {
      background: #0e0e1a;
      padding: 4px 14px;
      border-radius: 40px;
      font-family: monospace;
      font-size: 13px;
      color: #ffaa00;
      border: 1px solid #2a2a40;
      direction: ltr;
    }
    .btn {
      padding: 10px 22px;
      background: #ffcc00;
      color: #0b0b12;
      border: none;
      border-radius: 40px;
      font-weight: 600;
      font-size: 14px;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn:hover { transform: translateY(-2px); background: #ffe066; }
    .btn-outline {
      background: transparent;
      color: #ccc;
      border: 1px solid #3a3a4e;
    }
    .btn-outline:hover { background: #1a1a2e; border-color: #ffcc00; color: #fff; }
    .btn-danger { background: #dc3545; color: #fff; }
    .btn-danger:hover { background: #c82333; }
    .btn-sm { padding: 6px 14px; font-size: 12px; border-radius: 30px; }
    .btn-xs { padding: 4px 10px; font-size: 11px; border-radius: 30px; }
    .toolbar {
      display: flex;
      gap: 12px;
      margin-bottom: 22px;
      flex-wrap: wrap;
      align-items: center;
    }
    .toolbar .search-box {
      flex: 1;
      min-width: 180px;
      padding: 10px 18px;
      border-radius: 40px;
      border: 1px solid #2a2a40;
      background: #0e0e1a;
      color: #fff;
      font-family: inherit;
      font-size: 14px;
      outline: none;
    }
    .toolbar .search-box:focus { border-color: #ffcc00; }
    .table-wrap {
      overflow-x: auto;
      border-radius: 16px;
      border: 1px solid #1a1a2e;
      background: rgba(0, 0, 0, 0.25);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
      min-width: 720px;
    }
    th {
      background: #14141f;
      color: #ffcc00;
      font-weight: 600;
      padding: 14px 12px;
      text-align: center;
      border-bottom: 2px solid #2a2a40;
    }
    td {
      padding: 12px 10px;
      text-align: center;
      border-bottom: 1px solid #19192a;
      color: #d0d0e0;
    }
    tr:hover td { background: #161625; }
    .uuid-cell {
      font-family: monospace;
      font-size: 12px;
      color: #8a8aaa;
      direction: ltr;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .status-badge {
      display: inline-block;
      padding: 3px 14px;
      border-radius: 40px;
      font-size: 12px;
      font-weight: 500;
    }
    .status-active { background: rgba(0, 255, 100, 0.10); color: #0f0; border: 1px solid rgba(0, 255, 100, 0.08); }
    .status-expired { background: rgba(255, 70, 70, 0.10); color: #ff5555; border: 1px solid rgba(255, 70, 70, 0.08); }
    .empty-state { text-align: center; padding: 60px 20px; color: #5a5a72; font-size: 15px; }
    .empty-state span { font-size: 48px; display: block; margin-bottom: 12px; }
    .modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      justify-content: center;
      align-items: center;
      z-index: 1000;
      padding: 20px;
    }
    .modal-overlay.open { display: flex; }
    .modal {
      background: #1a1a2e;
      border-radius: 28px;
      padding: 32px 36px;
      max-width: 600px;
      width: 100%;
      border: 1px solid rgba(255, 204, 0, 0.06);
      box-shadow: 0 40px 90px rgba(0, 0, 0, 0.7);
      animation: modalFade 0.25s ease;
      max-height: 90vh;
      overflow-y: auto;
    }
    @keyframes modalFade {
      from { opacity: 0; transform: scale(0.94) translateY(16px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    .modal h3 {
      color: #ffcc00;
      font-size: 22px;
      margin-bottom: 22px;
      text-align: center;
      font-weight: 700;
    }
    .modal label {
      display: block;
      color: #a0a0b8;
      font-size: 13px;
      margin-bottom: 4px;
      margin-top: 14px;
      font-weight: 500;
    }
    .modal input, .modal select {
      width: 100%;
      padding: 10px 16px;
      background: #0e0e1a;
      border: 1px solid #2a2a40;
      border-radius: 14px;
      color: #fff;
      font-size: 14px;
      font-family: inherit;
      outline: none;
    }
    .modal input:focus, .modal select:focus { border-color: #ffcc00; }
    .modal .modal-actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
    }
    .modal .modal-actions .btn { flex: 1; justify-content: center; }
    .modal .config-box {
      background: #0e0e1a;
      border-radius: 12px;
      padding: 16px;
      margin: 8px 0;
      border: 1px solid #2a2a40;
      direction: ltr;
      text-align: left;
      font-family: monospace;
      font-size: 13px;
      color: #8a8aaa;
      word-break: break-all;
      max-height: 200px;
      overflow-y: auto;
    }
    .modal .config-box strong {
      color: #ffcc00;
      display: block;
      margin-bottom: 4px;
      direction: rtl;
    }
    .toast-container {
      position: fixed;
      bottom: 30px;
      right: 30px;
      z-index: 2000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: flex-end;
      max-width: 440px;
    }
    .toast {
      padding: 14px 24px;
      border-radius: 16px;
      color: #fff;
      font-weight: 500;
      font-size: 14px;
      font-family: inherit;
      opacity: 0;
      transform: translateX(50px) scale(0.94);
      transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
      width: fit-content;
      min-width: 180px;
    }
    .toast.show { opacity: 1; transform: translateX(0) scale(1); }
    .toast-success { background: rgba(16, 185, 129, 0.92); }
    .toast-error   { background: rgba(239, 68, 68, 0.92); }
    .toast-info    { background: rgba(59, 130, 246, 0.92); }
    @media (max-width: 820px) {
      .container { padding: 16px; }
      .logo { font-size: 22px; }
      .header { flex-direction: column; align-items: flex-start; }
      .token-bar { flex-direction: column; align-items: stretch; }
      .token-bar .token-value { max-width: 100%; }
      .toolbar { flex-direction: column; }
      .toolbar .search-box { width: 100%; }
      .btn { justify-content: center; }
      .modal { padding: 24px; max-width: 95%; }
      table { font-size: 13px; min-width: 600px; }
      th, td { padding: 8px 6px; }
    }
    @media (max-width: 480px) {
      .container { padding: 12px; }
      .logo { font-size: 18px; }
      .badge { font-size: 11px; padding: 4px 12px; }
      .token-bar { font-size: 13px; padding: 10px 14px; }
      .btn { font-size: 13px; padding: 8px 16px; }
      table { font-size: 12px; min-width: 480px; }
      th, td { padding: 6px 4px; }
      .uuid-cell { font-size: 10px; max-width: 80px; }
    }
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="logo">🦁 کیمارای <span>آهنین</span></div>
    <div><span class="badge">✅ پنل مدیریت</span></div>
  </div>

  <div class="token-bar">
    <span>🔑 توکن فعال:</span>
    <span class="token-value" id="currentTokenDisplay">—</span>
    <span style="color:#666;font-size:13px;">(از URL یا localStorage)</span>
    <div style="display:flex;gap:8px;margin-right:auto;flex-wrap:wrap;">
      <button class="btn btn-sm btn-outline" onclick="changeToken()">🔄 تغییر</button>
      <button class="btn btn-sm btn-outline" onclick="copyToken()">📋 کپی</button>
    </div>
  </div>

  <div class="toolbar">
    <button class="btn" onclick="openAddModal()">➕ افزودن کاربر</button>
    <button class="btn btn-outline" onclick="loadUsers()">🔄 بارگذاری</button>
    <input type="text" class="search-box" id="searchInput" placeholder="🔍 جستجو در کاربران (نام، UUID، پروتکل...)" />
  </div>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>نام کاربری</th>
          <th>UUID</th>
          <th>پروتکل</th>
          <th>سهمیه</th>
          <th>مصرف</th>
          <th>انقضا</th>
          <th>وضعیت</th>
          <th>عملیات</th>
        </tr>
      </thead>
      <tbody id="userTableBody">
        <tr><td colspan="8" class="empty-state"><span>⏳</span>در حال بارگذاری...</td></tr>
      </tbody>
    </table>
  </div>
</div>

<!-- مودال کانفیگ -->
<div class="modal-overlay" id="configModal">
  <div class="modal">
    <h3 id="configModalTitle">📋 کانفیگ کاربر</h3>
    <div id="configContent" style="margin-bottom:16px;"></div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeConfigModal()">بستن</button>
    </div>
  </div>
</div>

<!-- مودال افزودن/ویرایش -->
<div class="modal-overlay" id="modalOverlay">
  <div class="modal">
    <h3 id="modalTitle">➕ افزودن کاربر جدید</h3>
    <input type="hidden" id="editUuid" />
    <label>نام کاربری <span style="color:#ff5555;">*</span></label>
    <input type="text" id="f_username" placeholder="نام کاربری" />
    <label>UUID (اختیاری)</label>
    <input type="text" id="f_uuid" placeholder="خالی = تولید خودکار" />
    <label>رمز عبور (اختیاری)</label>
    <input type="text" id="f_password" placeholder="خالی = تولید خودکار" />
    <label>پروتکل</label>
    <select id="f_protocol">
      <option value="vless">VLESS</option>
      <option value="trojan">Trojan</option>
      <option value="shadowsocks">Shadowsocks</option>
      <option value="reality">Reality</option>
      <option value="hysteria2">Hysteria2</option>
      <option value="tuic">TUIC</option>
    </select>
    <label>سهمیه (GB)</label>
    <input type="number" id="f_quota" value="10" step="0.5" min="0" />
    <label>انقضا (روز از امروز)</label>
    <input type="number" id="f_expires" value="30" min="1" />
    <div class="modal-actions">
      <button class="btn" id="modalSaveBtn" onclick="saveUser()">💾 ذخیره</button>
      <button class="btn btn-outline" onclick="closeModal()">انصراف</button>
    </div>
  </div>
</div>

<!-- Toast -->
<div class="toast-container" id="toastContainer"></div>

<script>
  (function() {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    const tokenFromStorage = localStorage.getItem('admin_token');
    const TOKEN = tokenFromUrl || tokenFromStorage || 'admin123';

    if (tokenFromUrl && tokenFromUrl !== tokenFromStorage) {
      localStorage.setItem('admin_token', TOKEN);
    }

    document.getElementById('currentTokenDisplay').textContent = TOKEN;
    const API_BASE = '/admin/api';
    const WORKER_URL = window.location.origin;

    function showToast(msg, type = 'success') {
      const container = document.getElementById('toastContainer');
      const el = document.createElement('div');
      el.className = 'toast toast-' + type;
      el.textContent = msg;
      container.appendChild(el);
      requestAnimationFrame(() => el.classList.add('show'));
      setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 400);
      }, 3200);
    }

    function api(method, path, body = null) {
      const opts = {
        method,
        headers: { 'Authorization': 'Bearer ' + TOKEN }
      };
      if (body) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
      return fetch(API_BASE + path, opts).then(r => {
        if (!r.ok) {
          if (r.status === 401) throw new Error('Unauthorized — توکن نامعتبر');
          throw new Error('خطا (کد ' + r.status + ')');
        }
        return r.json();
      });
    }

    function loadUsers() {
      const tbody = document.getElementById('userTableBody');
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><span>⏳</span>در حال بارگذاری...</td></tr>';

      api('GET', '/users')
        .then(data => {
          if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><span>📭</span>هیچ کاربری یافت نشد</td></tr>';
            return;
          }
          tbody.innerHTML = data.map(u => {
            const expires = u.expires_at ? new Date(u.expires_at).toLocaleDateString('fa-IR') : 'نامحدود';
            const used = u.used ? u.used.toFixed(2) : '0';
            const status = u.expires_at && u.expires_at < Date.now() ? 'منقضی' : 'فعال';
            const statusClass = status === 'فعال' ? 'status-active' : 'status-expired';
            return \`
              <tr data-uuid="\${u.uuid}">
                <td><strong>\${u.username}</strong></td>
                <td class="uuid-cell" title="\${u.uuid}">\${u.uuid}</td>
                <td>\${u.protocol}</td>
                <td>\${u.quota}</td>
                <td>\${used}</td>
                <td>\${expires}</td>
                <td><span class="status-badge \${statusClass}">\${status}</span></td>
                <td>
                  <button class="btn btn-sm btn-outline" onclick="showConfig('\${u.uuid}')" title="دریافت کانفیگ" style="padding:4px 10px;font-size:11px;">🔗</button>
                  <button class="btn btn-sm btn-outline" onclick="editUser('\${u.uuid}')" style="padding:4px 10px;font-size:11px;">✏️</button>
                  <button class="btn btn-sm btn-danger" onclick="deleteUser('\${u.uuid}')" style="padding:4px 10px;font-size:11px;">🗑️</button>
                </td>
              </tr>
            \`;
          }).join('');
          const searchVal = document.getElementById('searchInput').value.trim();
          if (searchVal) applySearch(searchVal);
        })
        .catch(err => {
          tbody.innerHTML = '<tr><td colspan="8" class="empty-state" style="color:#ff5555;"><span>❌</span>' + err.message + '</td></tr>';
          showToast('خطا در بارگذاری کاربران: ' + err.message, 'error');
        });
    }

    function applySearch(q) {
      q = q.trim().toLowerCase();
      const rows = document.querySelectorAll('#userTableBody tr[data-uuid]');
      let found = 0;
      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (text.includes(q) || q === '') {
          row.style.display = '';
          found++;
        } else {
          row.style.display = 'none';
        }
      });
      const emptyRow = document.querySelector('#userTableBody tr.empty-search');
      if (found === 0 && q !== '') {
        if (!emptyRow) {
          const tr = document.createElement('tr');
          tr.className = 'empty-search';
          tr.innerHTML = '<td colspan="8" class="empty-state" style="color:#888;"><span>🔍</span>نتیجه‌ای برای جستجوی شما یافت نشد</td>';
          document.getElementById('userTableBody').appendChild(tr);
        }
      } else if (emptyRow) {
        emptyRow.remove();
      }
    }

    function searchUsers() {
      const q = document.getElementById('searchInput').value;
      applySearch(q);
    }

    // ---- مودال کانفیگ ----
    function showConfig(uuid) {
      const modal = document.getElementById('configModal');
      const title = document.getElementById('configModalTitle');
      const content = document.getElementById('configContent');
      title.textContent = '📋 کانفیگ کاربر';
      content.innerHTML = '⏳ در حال بارگذاری کانفیگ...';
      modal.classList.add('open');

      // دریافت اطلاعات کاربر
      api('GET', '/users')
        .then(data => {
          const user = data.find(u => u.uuid === uuid);
          if (!user) { content.innerHTML = '❌ کاربر یافت نشد'; return; }
          const username = user.username;
          const userUuid = user.uuid;
          const password = user.password;

          // ساخت لینک‌ها
          const host = new URL(WORKER_URL).host;
          const vlessLink = \`vless://\${userUuid}@\${host}:443?encryption=none&security=tls&sni=\${host}&fp=randomized&type=ws&host=\${host}&path=%2Fproxy%2Fvless%3Fuuid%3D\${userUuid}%26ed%3D2048#Kimaaraye-\${username}\`;
          const trojanLink = \`trojan://\${password}@\${host}:443?security=tls&sni=\${host}&fp=randomized&type=ws&host=\${host}&path=%2Fproxy%2Ftrojan%3Fuuid%3D\${userUuid}%26ed%3D2048#Kimaaraye-\${username}\`;
          const subLink = \`\${WORKER_URL}/sub?uuid=\${userUuid}&format=singbox\`;

          content.innerHTML = \`
            <label>👤 کاربر: <strong>\${username}</strong></label>
            <label>🔑 UUID: <code style="direction:ltr;">\${userUuid}</code></label>
            <div style="margin-top:12px;">
              <strong style="color:#ffcc00;">🔗 لینک‌های اتصال:</strong>
              <div class="config-box"><strong>VLESS:</strong>\${vlessLink}</div>
              <div class="config-box"><strong>Trojan:</strong>\${trojanLink}</div>
              <div class="config-box"><strong>📥 کانفیگ Sing-box:</strong>\${subLink}</div>
              <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
                <button class="btn btn-sm btn-outline" onclick="copyText('\${vlessLink}')">📋 کپی VLESS</button>
                <button class="btn btn-sm btn-outline" onclick="copyText('\${trojanLink}')">📋 کپی Trojan</button>
                <button class="btn btn-sm btn-outline" onclick="copyText('\${subLink}')">📋 کپی لینک ساب</button>
              </div>
            </div>
          \`;
        })
        .catch(err => {
          content.innerHTML = '❌ خطا در دریافت کانفیگ: ' + err.message;
        });
    }

    function closeConfigModal() {
      document.getElementById('configModal').classList.remove('open');
    }

    function copyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
          .then(() => showToast('✅ کپی شد!', 'success'))
          .catch(() => fallbackCopy(text));
      } else {
        fallbackCopy(text);
      }
    }

    function fallbackCopy(text) {
      const input = document.createElement('input');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      try {
        document.execCommand('copy');
        showToast('✅ کپی شد!', 'success');
      } catch {
        showToast('❌ کپی ناموفق', 'error');
      }
      input.remove();
    }

    // ---- مودال افزودن/ویرایش ----
    function openModal(title, data = null) {
      document.getElementById('modalTitle').textContent = title;
      document.getElementById('editUuid').value = data?.uuid || '';
      document.getElementById('f_username').value = data?.username || '';
      document.getElementById('f_uuid').value = data?.uuid || '';
      document.getElementById('f_password').value = '';
      document.getElementById('f_protocol').value = data?.protocol || 'vless';
      document.getElementById('f_quota').value = data?.quota || 10;
      document.getElementById('f_expires').value = 30;
      document.getElementById('modalOverlay').classList.add('open');
      setTimeout(() => document.getElementById('f_username').focus(), 100);
    }

    function closeModal() {
      document.getElementById('modalOverlay').classList.remove('open');
    }

    function openAddModal() {
      openModal('➕ افزودن کاربر جدید');
    }

    function editUser(uuid) {
      api('GET', '/users')
        .then(data => {
          const user = data.find(u => u.uuid === uuid);
          if (!user) { showToast('کاربر یافت نشد', 'error'); return; }
          openModal('✏️ ویرایش کاربر', user);
        })
        .catch(() => showToast('خطا در دریافت اطلاعات کاربر', 'error'));
    }

    function saveUser() {
      const uuid = document.getElementById('editUuid').value;
      const username = document.getElementById('f_username').value.trim();
      if (!username) {
        showToast('❌ نام کاربری الزامی است', 'error');
        document.getElementById('f_username').focus();
        return;
      }

      const data = {
        username: username,
        uuid: document.getElementById('f_uuid').value.trim() || undefined,
        password: document.getElementById('f_password').value.trim() || undefined,
        protocol: document.getElementById('f_protocol').value,
        quota: parseFloat(document.getElementById('f_quota').value) || 10,
        expires_at: Date.now() + (parseInt(document.getElementById('f_expires').value) || 30) * 86400000
      };

      const isEdit = !!uuid;
      const method = isEdit ? 'PUT' : 'POST';
      const path = isEdit ? '/users/' + uuid : '/users';

      const btn = document.getElementById('modalSaveBtn');
      btn.disabled = true;
      btn.textContent = '⏳ در حال ذخیره...';

      api(method, path, data)
        .then(() => {
          closeModal();
          loadUsers();
          showToast(isEdit ? '✅ کاربر بروزرسانی شد' : '✅ کاربر افزوده شد', 'success');
        })
        .catch(err => {
          showToast('❌ خطا در ذخیره: ' + err.message, 'error');
        })
        .finally(() => {
          btn.disabled = false;
          btn.textContent = '💾 ذخیره';
        });
    }

    function deleteUser(uuid) {
      if (!confirm('آیا از حذف این کاربر مطمئن هستید؟')) return;
      api('DELETE', '/users/' + uuid)
        .then(() => {
          loadUsers();
          showToast('✅ کاربر حذف شد', 'success');
        })
        .catch(err => {
          showToast('❌ خطا در حذف: ' + err.message, 'error');
        });
    }

    function changeToken() {
      const current = document.getElementById('currentTokenDisplay').textContent;
      const newToken = prompt('توکن جدید را وارد کنید:', current);
      if (newToken && newToken.trim() && newToken.trim() !== current) {
        const trimmed = newToken.trim();
        localStorage.setItem('admin_token', trimmed);
        document.getElementById('currentTokenDisplay').textContent = trimmed;
        showToast('✅ توکن تغییر کرد. صفحه مجدداً بارگذاری می‌شود...', 'success');
        setTimeout(() => {
          const url = new URL(window.location.href);
          url.searchParams.set('token', trimmed);
          window.location.href = url.toString();
        }, 1000);
      } else if (newToken && newToken.trim() === current) {
        showToast('ℹ️ توکن تغییری نکرد', 'info');
      }
    }

    function copyToken() {
      const token = document.getElementById('currentTokenDisplay').textContent;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(token)
          .then(() => showToast('✅ توکن کپی شد', 'success'))
          .catch(() => fallbackCopy(token));
      } else {
        fallbackCopy(token);
      }
    }

    window.loadUsers = loadUsers;
    window.searchUsers = searchUsers;
    window.openAddModal = openAddModal;
    window.closeModal = closeModal;
    window.editUser = editUser;
    window.saveUser = saveUser;
    window.deleteUser = deleteUser;
    window.changeToken = changeToken;
    window.copyToken = copyToken;
    window.showConfig = showConfig;
    window.closeConfigModal = closeConfigModal;
    window.copyText = copyText;

    document.getElementById('searchInput').addEventListener('input', searchUsers);
    document.getElementById('modalOverlay').addEventListener('click', function(e) {
      if (e.target === this) closeModal();
    });
    document.getElementById('configModal').addEventListener('click', function(e) {
      if (e.target === this) closeConfigModal();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeModal();
        closeConfigModal();
      }
    });

    loadUsers();
  })();
</script>
</body>
</html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
