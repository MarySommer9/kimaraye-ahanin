// ============================================
// 🦁 کیمارای آهنین - پنل مدیریت
// ============================================

import { Env, User } from '../types';
import { listUsers, createUser, updateUser, deleteUser } from './auth';

// ==================== API پنل مدیریت ====================
export async function adminAPI(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  // ===== احراز هویت ادمین (با اولویت Environment Variable) =====
  // ۱. اول از Environment Variable (ADMIN_TOKEN) بخون
  // ۲. اگه نبود، از KV بخون
  // ۳. در نهایت مقدار پیش‌فرض 'admin123'
  const adminToken = env.ADMIN_TOKEN || (await env.KV?.get('admin_token')) || 'admin123';
  
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '') || '';
  
  if (!token || token !== adminToken) {
    return new Response('Unauthorized', { 
      status: 401,
      headers: { 'WWW-Authenticate': 'Bearer' }
    });
  }

  // ===== مسیرها =====

  // ---------- GET /admin/api/users ----------
  if (url.pathname === '/admin/api/users' && request.method === 'GET') {
    const users = await listUsers(env);
    return new Response(JSON.stringify(users), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ---------- POST /admin/api/users ----------
  if (url.pathname === '/admin/api/users' && request.method === 'POST') {
    try {
      const data = await request.json() as Partial<User>;
      const newUser = await createUser(env, data);
      return new Response(JSON.stringify(newUser), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to create user' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // ---------- PUT /admin/api/users/:uuid ----------
  if (url.pathname.startsWith('/admin/api/users/') && request.method === 'PUT') {
    const uuid = url.pathname.split('/').pop();
    if (!uuid) {
      return new Response(JSON.stringify({ error: 'Missing UUID' }), { status: 400 });
    }
    try {
      const updates = await request.json() as Partial<User>;
      await updateUser(env, uuid, updates);
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to update user' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // ---------- DELETE /admin/api/users/:uuid ----------
  if (url.pathname.startsWith('/admin/api/users/') && request.method === 'DELETE') {
    const uuid = url.pathname.split('/').pop();
    if (!uuid) {
      return new Response(JSON.stringify({ error: 'Missing UUID' }), { status: 400 });
    }
    try {
      await deleteUser(env, uuid);
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to delete user' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // ---------- صفحه‌ی HTML پنل مدیریت ----------
  return new Response(`
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>کیمارای آهنین - مدیریت</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Vazir', Tahoma, sans-serif;
          background: #0a0a0f;
          color: #eee;
          padding: 20px;
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: flex-start;
        }
        .container {
          max-width: 1200px;
          width: 100%;
          background: rgba(20, 20, 35, 0.8);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 0 40px rgba(255, 204, 0, 0.05);
          border: 1px solid rgba(255, 204, 0, 0.1);
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #ffcc00;
          padding-bottom: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          color: #ffcc00;
        }
        .logo span { color: #ffaa00; }
        .token-status {
          background: rgba(0, 255, 100, 0.1);
          color: #0f0;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 14px;
          border: 1px solid rgba(0, 255, 100, 0.2);
        }
        .toolbar {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .btn {
          padding: 10px 20px;
          background: #ffcc00;
          color: #000;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: bold;
          transition: all 0.2s;
          font-size: 14px;
        }
        .btn:hover { background: #ffaa00; transform: scale(1.02); }
        .btn-danger { background: #ff4444; color: #fff; }
        .btn-danger:hover { background: #cc0000; }
        .btn-secondary { background: #333; color: #eee; }
        .btn-secondary:hover { background: #444; }
        .table-wrapper { overflow-x: auto; }
        .table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
          font-size: 14px;
        }
        .table th {
          background: #1a1a2e;
          padding: 12px 10px;
          border: 1px solid #2a2a3e;
          text-align: center;
          color: #ffcc00;
          font-weight: bold;
        }
        .table td {
          padding: 10px;
          border: 1px solid #2a2a3e;
          text-align: center;
          color: #ccc;
        }
        .table tr:hover { background: #1a1a2e; }
        .modal {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.8);
          justify-content: center;
          align-items: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }
        .modal-content {
          background: #1a1a2e;
          padding: 30px;
          border-radius: 12px;
          width: 90%;
          max-width: 480px;
          border: 1px solid rgba(255, 204, 0, 0.2);
          box-shadow: 0 0 60px rgba(0,0,0,0.5);
        }
        .modal-content h3 {
          color: #ffcc00;
          margin-bottom: 16px;
          text-align: center;
        }
        .modal-content input, .modal-content select {
          width: 100%;
          padding: 10px 12px;
          margin: 6px 0 14px 0;
          background: #0a0a0f;
          border: 1px solid #333;
          border-radius: 6px;
          color: #fff;
          font-size: 14px;
          outline: none;
        }
        .modal-content input:focus, .modal-content select:focus {
          border-color: #ffcc00;
        }
        .modal-content label {
          color: #aaa;
          font-size: 13px;
        }
        .modal-actions {
          display: flex;
          gap: 10px;
          margin-top: 16px;
          justify-content: flex-end;
        }
        .modal-actions .btn { flex: 1; }
        .toast {
          position: fixed;
          bottom: 30px;
          right: 30px;
          padding: 14px 24px;
          border-radius: 8px;
          color: #fff;
          font-weight: bold;
          z-index: 2000;
          opacity: 0;
          transform: translateY(20px);
          transition: all 0.3s ease;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        .toast.show {
          opacity: 1;
          transform: translateY(0);
        }
        .toast.success { background: #00aa44; }
        .toast.error { background: #cc2233; }
        .toast.info { background: #2266cc; }
        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #666;
        }
        @media (max-width: 768px) {
          .container { padding: 16px; }
          .header { flex-direction: column; align-items: flex-start; }
          .logo { font-size: 22px; }
          .toolbar { flex-direction: column; }
          .btn { width: 100%; text-align: center; }
          .table th, .table td { padding: 6px; font-size: 12px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🦁 کیمارای آهنین <span>| مدیریت</span></div>
          <div>
            <span class="token-status" id="tokenStatus">✅ متصل</span>
          </div>
        </div>

        <div class="toolbar">
          <button class="btn" onclick="showAddUser()">➕ افزودن کاربر</button>
          <button class="btn btn-secondary" onclick="loadUsers()">🔄 بارگذاری مجدد</button>
        </div>

        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>نام کاربری</th>
                <th>UUID</th>
                <th>پروتکل</th>
                <th>سهمیه (GB)</th>
                <th>مصرف</th>
                <th>انقضا</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody id="userList">
              <tr><td colspan="7" class="empty-state">⏳ در حال بارگذاری...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Modal افزودن کاربر -->
      <div id="addUserModal" class="modal">
        <div class="modal-content">
          <h3>➕ افزودن کاربر جدید</h3>
          <label>نام کاربری</label>
          <input type="text" id="username" placeholder="نام کاربری">
          <label>UUID (اختیاری)</label>
          <input type="text" id="uuid" placeholder="UUID (اختیاری)">
          <label>رمز عبور (اختیاری)</label>
          <input type="text" id="password" placeholder="رمز (اختیاری)">
          <label>پروتکل</label>
          <select id="protocol">
            <option value="vless">VLESS</option>
            <option value="trojan">Trojan</option>
            <option value="shadowsocks">Shadowsocks</option>
            <option value="reality">Reality</option>
            <option value="hysteria2">Hysteria2</option>
            <option value="tuic">TUIC</option>
          </select>
          <label>سهمیه (GB)</label>
          <input type="number" id="quota" placeholder="سهمیه (GB)" value="10">
          <label>انقضا (روز از امروز)</label>
          <input type="number" id="expires" placeholder="انقضا (روز)" value="30">
          <div class="modal-actions">
            <button class="btn" onclick="addUser()">✅ ثبت</button>
            <button class="btn btn-secondary" onclick="closeModal()">❌ انصراف</button>
          </div>
        </div>
      </div>

      <!-- Toast -->
      <div id="toast" class="toast"></div>

      <script>
        const API_BASE = '/admin/api';
        const TOKEN = localStorage.getItem('admin_token') || 'admin123';

        // نمایش پیام Toast
        function showToast(message, type = 'success') {
          const toast = document.getElementById('toast');
          toast.textContent = message;
          toast.className = 'toast ' + type + ' show';
          clearTimeout(toast._timer);
          toast._timer = setTimeout(() => {
            toast.classList.remove('show');
          }, 3000);
        }

        // بارگذاری لیست کاربران
        function loadUsers() {
          const tbody = document.getElementById('userList');
          tbody.innerHTML = '<tr><td colspan="7" class="empty-state">⏳ در حال بارگذاری...</td></tr>';

          fetch(API_BASE + '/users', {
            headers: { 'Authorization': 'Bearer ' + TOKEN }
          })
          .then(res => {
            if (!res.ok) throw new Error('Unauthorized or server error');
            return res.json();
          })
          .then(data => {
            if (!data || data.length === 0) {
              tbody.innerHTML = '<tr><td colspan="7" class="empty-state">📭 هیچ کاربری یافت نشد</td></tr>';
              return;
            }
            tbody.innerHTML = data.map(user => {
              const expires = user.expires_at ? new Date(user.expires_at).toLocaleDateString('fa-IR') : 'نامحدود';
              const used = user.used ? user.used.toFixed(2) : '0';
              return \`
                <tr>
                  <td>\${user.username}</td>
                  <td style="font-family:monospace;font-size:12px;">\${user.uuid}</td>
                  <td>\${user.protocol}</td>
                  <td>\${user.quota}</td>
                  <td>\${used}</td>
                  <td>\${expires}</td>
                  <td>
                    <button class="btn" onclick="editUser('\${user.uuid}')" style="padding:4px 12px;font-size:12px;">✏️</button>
                    <button class="btn btn-danger" onclick="removeUser('\${user.uuid}')" style="padding:4px 12px;font-size:12px;">🗑️</button>
                  </td>
                </tr>
              \`;
            }).join('');
          })
          .catch(err => {
            tbody.innerHTML = \`<tr><td colspan="7" class="empty-state" style="color:#ff4444;">❌ خطا: \${err.message}</td></tr>\`;
            showToast('خطا در بارگذاری کاربران', 'error');
          });
        }

        // نمایش مودال افزودن کاربر
        function showAddUser() {
          document.getElementById('addUserModal').style.display = 'flex';
        }

        function closeModal() {
          document.getElementById('addUserModal').style.display = 'none';
        }

        // افزودن کاربر جدید
        function addUser() {
          const data = {
            username: document.getElementById('username').value.trim(),
            uuid: document.getElementById('uuid').value.trim() || undefined,
            password: document.getElementById('password').value.trim() || undefined,
            protocol: document.getElementById('protocol').value,
            quota: parseFloat(document.getElementById('quota').value) || 10,
            expires_at: Date.now() + (parseInt(document.getElementById('expires').value) || 30) * 86400000
          };

          if (!data.username) {
            showToast('❌ نام کاربری الزامی است', 'error');
            return;
          }

          fetch(API_BASE + '/users', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + TOKEN
            },
            body: JSON.stringify(data)
          })
          .then(res => res.json())
          .then(() => {
            closeModal();
            loadUsers();
            showToast('✅ کاربر با موفقیت افزوده شد', 'success');
            // پاک کردن فرم
            document.getElementById('username').value = '';
            document.getElementById('uuid').value = '';
            document.getElementById('password').value = '';
          })
          .catch(() => {
            showToast('❌ خطا در افزودن کاربر', 'error');
          });
        }

        // حذف کاربر
        function removeUser(uuid) {
          if (!confirm('آیا از حذف این کاربر مطمئن هستید؟')) return;
          fetch(API_BASE + '/users/' + uuid, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + TOKEN }
          })
          .then(() => {
            loadUsers();
            showToast('✅ کاربر حذف شد', 'success');
          })
          .catch(() => {
            showToast('❌ خطا در حذف کاربر', 'error');
          });
        }

        // ویرایش کاربر (فعلاً placeholder)
        function editUser(uuid) {
          showToast('✏️ ویرایش کاربر: ' + uuid + ' (به‌زودی اضافه می‌شود)', 'info');
        }

        // بارگذاری اولیه
        loadUsers();

        // بستن مودال با کلیک خارج
        document.getElementById('addUserModal').addEventListener('click', function(e) {
          if (e.target === this) closeModal();
        });
      </script>
    </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
