// ============================================
// 🦁 کیمارای آهنین - پنل مدیریت حرفه‌ای
// ============================================

import { Env, User } from '../types';
import { listUsers, createUser, updateUser, deleteUser } from './auth';

export async function adminAPI(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  // === احراز هویت ===
  const adminToken = env.ADMIN_TOKEN || (await env.KV.get('admin_token')) || 'admin123';
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '') || '';

  if (!token || token !== adminToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  // === API ها ===

  // GET /admin/api/users
  if (url.pathname === '/admin/api/users' && request.method === 'GET') {
    const users = await listUsers(env);
    return Response.json(users);
  }

  // POST /admin/api/users
  if (url.pathname === '/admin/api/users' && request.method === 'POST') {
    try {
      const data = await request.json() as Partial<User>;
      const newUser = await createUser(env, data);
      return Response.json(newUser, { status: 201 });
    } catch {
      return Response.json({ error: 'Failed to create user' }, { status: 400 });
    }
  }

  // PUT /admin/api/users/:uuid
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

  // DELETE /admin/api/users/:uuid
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

  // === صفحه HTML پنل مدیریت ===
  return new Response(
    `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>کیمارای آهنین · مدیریت</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, 'Vazir', sans-serif;
      background: #0b0b12;
      color: #e8e8f0;
      padding: 24px;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    .container {
      max-width: 1300px;
      width: 100%;
      background: rgba(18, 18, 32, 0.85);
      backdrop-filter: blur(6px);
      border-radius: 28px;
      padding: 28px 32px;
      border: 1px solid rgba(255, 204, 0, 0.08);
      box-shadow: 0 30px 60px rgba(0,0,0,0.6);
    }
    /* هدر */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #ffcc00;
      padding-bottom: 16px;
      margin-bottom: 28px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .logo {
      font-size: 28px;
      font-weight: 700;
      color: #ffcc00;
      letter-spacing: -0.5px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .logo span { color: #ffaa00; font-weight: 300; }
    .badge {
      background: rgba(0, 255, 100, 0.12);
      color: #0f0;
      padding: 6px 18px;
      border-radius: 40px;
      font-size: 13px;
      border: 1px solid rgba(0, 255, 100, 0.15);
    }
    /* نوار ابزار */
    .toolbar {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    .btn {
      padding: 10px 24px;
      background: #ffcc00;
      color: #0b0b12;
      border: none;
      border-radius: 40px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 4px 14px rgba(255, 204, 0, 0.15);
    }
    .btn:hover { transform: translateY(-2px); background: #ffe066; box-shadow: 0 8px 24px rgba(255, 204, 0, 0.25); }
    .btn-outline {
      background: transparent;
      color: #ccc;
      border: 1px solid #3a3a4e;
      box-shadow: none;
    }
    .btn-outline:hover { background: #1e1e30; border-color: #ffcc00; color: #fff; }
    .btn-danger {
      background: #dc3545;
      color: #fff;
      box-shadow: 0 4px 14px rgba(220, 53, 69, 0.2);
    }
    .btn-danger:hover { background: #c82333; box-shadow: 0 8px 24px rgba(220, 53, 69, 0.3); }
    .btn-sm { padding: 6px 14px; font-size: 12px; }
    /* جدول */
    .table-wrap { overflow-x: auto; border-radius: 16px; border: 1px solid #1e1e30; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
      min-width: 700px;
    }
    th {
      background: #14141f;
      color: #ffcc00;
      font-weight: 600;
      padding: 14px 12px;
      text-align: center;
      border-bottom: 2px solid #2a2a40;
      white-space: nowrap;
    }
    td {
      padding: 12px;
      text-align: center;
      border-bottom: 1px solid #1a1a2a;
      color: #d0d0e0;
      vertical-align: middle;
    }
    tr:hover td { background: #161625; }
    .uuid-cell { font-family: monospace; font-size: 12px; color: #8a8aaa; max-width: 160px; overflow: hidden; text-overflow: ellipsis; }
    .status-badge {
      display: inline-block;
      padding: 2px 12px;
      border-radius: 40px;
      font-size: 12px;
      font-weight: 500;
    }
    .status-active { background: rgba(0, 255, 100, 0.12); color: #0f0; }
    .status-expired { background: rgba(255, 70, 70, 0.12); color: #ff5555; }
    /* مودال */
    .modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.75);
      backdrop-filter: blur(6px);
      justify-content: center;
      align-items: center;
      z-index: 1000;
      padding: 20px;
    }
    .modal-overlay.open { display: flex; }
    .modal {
      background: #1a1a2e;
      border-radius: 24px;
      padding: 32px 36px;
      max-width: 520px;
      width: 100%;
      border: 1px solid rgba(255, 204, 0, 0.08);
      box-shadow: 0 40px 80px rgba(0,0,0,0.7);
      animation: modalFade 0.25s ease;
    }
    @keyframes modalFade {
      from { opacity:0; transform:scale(0.95) translateY(20px); }
      to   { opacity:1; transform:scale(1) translateY(0); }
    }
    .modal h3 {
      color: #ffcc00;
      font-size: 22px;
      margin-bottom: 24px;
      text-align: center;
    }
    .modal label {
      display: block;
      color: #a0a0b8;
      font-size: 13px;
      margin-bottom: 4px;
      margin-top: 12px;
    }
    .modal input, .modal select {
      width: 100%;
      padding: 10px 14px;
      background: #0e0e1a;
      border: 1px solid #2a2a40;
      border-radius: 12px;
      color: #fff;
      font-size: 14px;
      outline: none;
      transition: 0.2s;
    }
    .modal input:focus, .modal select:focus { border-color: #ffcc00; box-shadow: 0 0 0 3px rgba(255, 204, 0, 0.1); }
    .modal-actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
    }
    .modal-actions .btn { flex: 1; justify-content: center; }
    /* Toast */
    .toast-container {
      position: fixed;
      bottom: 30px;
      right: 30px;
      z-index: 2000;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .toast {
      padding: 14px 24px;
      border-radius: 16px;
      color: #fff;
      font-weight: 500;
      font-size: 14px;
      opacity: 0;
      transform: translateX(40px);
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: 0 12px 32px rgba(0,0,0,0.4);
      max-width: 400px;
    }
    .toast.show { opacity: 1; transform: translateX(0); }
    .toast-success { background: #10b981; }
    .toast-error { background: #ef4444; }
    .toast-info { background: #3b82f6; }
    /* خالی */
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #5a5a72;
    }
    .empty-state span { font-size: 48px; display: block; margin-bottom: 12px; }
    /* واکنش‌گرا */
    @media (max-width: 768px) {
      .container { padding: 16px; }
      .logo { font-size: 20px; }
      .header { flex-direction: column; align-items: flex-start; }
      .toolbar { flex-direction: column; }
      .btn { width: 100%; justify-content: center; }
      .modal { padding: 24px; }
    }
  </style>
</head>
<body>

<div class="container">
  <!-- هدر -->
  <div class="header">
    <div class="logo">🦁 کیمارای <span>آهنین</span></div>
    <div>
      <span class="badge">✅ پنل مدیریت</span>
    </div>
  </div>

  <!-- نوار ابزار -->
  <div class="toolbar">
    <button class="btn" onclick="openAddModal()">➕ افزودن کاربر</button>
    <button class="btn btn-outline" onclick="loadUsers()">🔄 بارگذاری مجدد</button>
    <button class="btn btn-outline" onclick="searchUsers()">🔍 جستجو</button>
    <input type="text" id="searchInput" placeholder="جستجو در کاربران..." style="flex:1;min-width:160px;padding:10px 16px;border-radius:40px;border:1px solid #2a2a40;background:#0e0e1a;color:#fff;outline:none;">
  </div>

  <!-- جدول -->
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>نام کاربری</th>
          <th>UUID</th>
          <th>پروتکل</th>
          <th>سهمیه (GB)</th>
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

<!-- مودال افزودن/ویرایش -->
<div class="modal-overlay" id="modalOverlay">
  <div class="modal">
    <h3 id="modalTitle">➕ افزودن کاربر جدید</h3>
    <input type="hidden" id="editUuid" />
    <label>نام کاربری</label>
    <input type="text" id="f_username" placeholder="نام کاربری" />
    <label>UUID (اختیاری)</label>
    <input type="text" id="f_uuid" placeholder="UUID (خالی = خودکار)" />
    <label>رمز عبور (اختیاری)</label>
    <input type="text" id="f_password" placeholder="رمز عبور (خالی = خودکار)" />
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
    <input type="number" id="f_quota" value="10" />
    <label>انقضا (روز از امروز)</label>
    <input type="number" id="f_expires" value="30" />
    <div class="modal-actions">
      <button class="btn" id="modalSaveBtn" onclick="saveUser()">💾 ذخیره</button>
      <button class="btn btn-outline" onclick="closeModal()">انصراف</button>
    </div>
  </div>
</div>

<!-- Toast -->
<div class="toast-container" id="toastContainer"></div>

<script>
  // ===== تنظیمات =====
  const TOKEN = 'admin123'; // یا از env بگیرید
  const API_BASE = '/admin/api';

  // ===== توابع کمکی =====
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
    }, 3000);
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
      if (!r.ok) throw new Error('خطا در درخواست');
      return r.json();
    });
  }

  // ===== بارگذاری کاربران =====
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
            <tr>
              <td><strong>\${u.username}</strong></td>
              <td class="uuid-cell">\${u.uuid}</td>
              <td>\${u.protocol}</td>
              <td>\${u.quota}</td>
              <td>\${used}</td>
              <td>\${expires}</td>
              <td><span class="status-badge \${statusClass}">\${status}</span></td>
              <td>
                <button class="btn btn-sm" onclick="editUser('\${u.uuid}')">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="deleteUser('\${u.uuid}')">🗑️</button>
              </td>
            </tr>
          \`;
        }).join('');
      })
      .catch(err => {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state" style="color:#ff5555;"><span>❌</span>' + err.message + '</td></tr>';
        showToast('خطا در بارگذاری کاربران', 'error');
      });
  }

  // ===== جستجو =====
  function searchUsers() {
    const q = document.getElementById('searchInput').value.trim().toLowerCase();
    const rows = document.querySelectorAll('#userTableBody tr');
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
    if (found === 0 && q !== '') {
      showToast('🔍 هیچ کاربری یافت نشد', 'info');
    }
  }

  // ===== مودال =====
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

  // ===== ذخیره کاربر =====
  function saveUser() {
    const uuid = document.getElementById('editUuid').value;
    const data = {
      username: document.getElementById('f_username').value.trim(),
      uuid: document.getElementById('f_uuid').value.trim() || undefined,
      password: document.getElementById('f_password').value.trim() || undefined,
      protocol: document.getElementById('f_protocol').value,
      quota: parseFloat(document.getElementById('f_quota').value) || 10,
      expires_at: Date.now() + (parseInt(document.getElementById('f_expires').value) || 30) * 86400000
    };
    if (!data.username) {
      showToast('❌ نام کاربری الزامی است', 'error');
      return;
    }
    const isEdit = !!uuid;
    const method = isEdit ? 'PUT' : 'POST';
    const path = isEdit ? '/users/' + uuid : '/users';
    api(method, path, data)
      .then(() => {
        closeModal();
        loadUsers();
        showToast(isEdit ? '✅ کاربر بروزرسانی شد' : '✅ کاربر افزوده شد', 'success');
      })
      .catch(() => showToast('❌ خطا در ذخیره کاربر', 'error'));
  }

  // ===== حذف کاربر =====
  function deleteUser(uuid) {
    if (!confirm('آیا از حذف این کاربر مطمئن هستید؟')) return;
    api('DELETE', '/users/' + uuid)
      .then(() => {
        loadUsers();
        showToast('✅ کاربر حذف شد', 'success');
      })
      .catch(() => showToast('❌ خطا در حذف کاربر', 'error'));
  }

  // ===== جستجوی زنده =====
  document.getElementById('searchInput').addEventListener('input', searchUsers);

  // ===== بستن مودال با کلیک خارج =====
  document.getElementById('modalOverlay').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });

  // ===== بارگذاری اولیه =====
  loadUsers();
</script>
</body>
</html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}
