// ============================================
// 🦁 کیمارای آهنین - پنل مدیریت
// ============================================

import { Env, User } from '../types';
import { listUsers, createUser, updateUser, deleteUser } from './auth';

// ==================== API پنل مدیریت ====================
export async function adminAPI(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  // بررسی توکن ادمین (از KV)
  const adminToken = await env.KV.get('admin_token') || 'admin123';
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token || token !== adminToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  // ---------- GET /admin/api/users ----------
  if (url.pathname === '/admin/api/users' && request.method === 'GET') {
    const users = await listUsers(env);
    return new Response(JSON.stringify(users), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ---------- POST /admin/api/users ----------
  if (url.pathname === '/admin/api/users' && request.method === 'POST') {
    const data = await request.json() as Partial<User>;
    const newUser = await createUser(env, data);
    return new Response(JSON.stringify(newUser), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ---------- PUT /admin/api/users/:uuid ----------
  if (url.pathname.startsWith('/admin/api/users/') && request.method === 'PUT') {
    const uuid = url.pathname.split('/').pop();
    if (!uuid) return new Response('Missing UUID', { status: 400 });
    const updates = await request.json() as Partial<User>;
    await updateUser(env, uuid, updates);
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ---------- DELETE /admin/api/users/:uuid ----------
  if (url.pathname.startsWith('/admin/api/users/') && request.method === 'DELETE') {
    const uuid = url.pathname.split('/').pop();
    if (!uuid) return new Response('Missing UUID', { status: 400 });
    await deleteUser(env, uuid);
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
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
        body { font-family: 'Vazir', sans-serif; background: #0a0a0f; color: #eee; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ffcc00; padding-bottom: 10px; }
        .logo { font-size: 24px; font-weight: bold; color: #ffcc00; }
        .logo span { color: #ffaa00; }
        .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .table th, .table td { padding: 10px; border: 1px solid #333; text-align: center; }
        .table th { background: #222; }
        .btn { padding: 8px 16px; background: #ffcc00; color: #000; border: none; border-radius: 4px; cursor: pointer; }
        .btn-danger { background: #ff4444; color: #fff; }
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); justify-content: center; align-items: center; }
        .modal-content { background: #1a1a2e; padding: 30px; border-radius: 8px; width: 400px; }
        .modal input { width: 100%; padding: 8px; margin: 8px 0; background: #2a2a3e; border: none; color: #fff; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🦁 کیمارای آهنین <span>| مدیریت</span></div>
          <div>
            <span id="tokenStatus">🔓 متصل</span>
          </div>
        </div>
        <div style="margin-top: 20px;">
          <button class="btn" onclick="showAddUser()">➕ افزودن کاربر</button>
          <button class="btn" onclick="loadUsers()">🔄 بارگذاری مجدد</button>
        </div>
        <table class="table" id="userTable">
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
          <tbody id="userList"></tbody>
        </table>
      </div>

      <!-- Modal افزودن کاربر -->
      <div id="addUserModal" class="modal">
        <div class="modal-content">
          <h3>افزودن کاربر جدید</h3>
          <input type="text" id="username" placeholder="نام کاربری">
          <input type="text" id="uuid" placeholder="UUID (اختیاری)">
          <input type="text" id="password" placeholder="رمز (اختیاری)">
          <select id="protocol">
            <option value="vless">VLESS</option>
            <option value="trojan">Trojan</option>
            <option value="shadowsocks">Shadowsocks</option>
          </select>
          <input type="number" id="quota" placeholder="سهمیه (GB)" value="10">
          <input type="number" id="expires" placeholder="انقضا (روز از امروز)" value="30">
          <button class="btn" onclick="addUser()">ثبت</button>
          <button class="btn" onclick="closeModal()">انصراف</button>
        </div>
      </div>

      <script>
        const API_BASE = '/admin/api';
        const TOKEN = 'admin123';

        function loadUsers() {
          fetch(API_BASE + '/users', {
            headers: { 'Authorization': 'Bearer ' + TOKEN }
          })
          .then(res => res.json())
          .then(data => {
            const tbody = document.getElementById('userList');
            tbody.innerHTML = data.map(user => {
              const expires = user.expires_at ? new Date(user.expires_at).toLocaleDateString('fa-IR') : 'نامحدود';
              return \`
                <tr>
                  <td>\${user.username}</td>
                  <td>\${user.uuid}</td>
                  <td>\${user.protocol}</td>
                  <td>\${user.quota}</td>
                  <td>\${user.used ? user.used.toFixed(2) : 0}</td>
                  <td>\${expires}</td>
                  <td>
                    <button class="btn" onclick="editUser('\${user.uuid}')">✏️</button>
                    <button class="btn btn-danger" onclick="removeUser('\${user.uuid}')">🗑️</button>
                  </td>
                </tr>
              \`;
            }).join('');
          });
        }

        function showAddUser() {
          document.getElementById('addUserModal').style.display = 'flex';
        }

        function closeModal() {
          document.getElementById('addUserModal').style.display = 'none';
        }

        function addUser() {
          const data = {
            username: document.getElementById('username').value,
            uuid: document.getElementById('uuid').value || undefined,
            password: document.getElementById('password').value || undefined,
            protocol: document.getElementById('protocol').value,
            quota: parseInt(document.getElementById('quota').value),
            expires_at: Date.now() + (parseInt(document.getElementById('expires').value) * 86400000)
          };

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
          });
        }

        function removeUser(uuid) {
          if (!confirm('آیا از حذف این کاربر مطمئن هستید؟')) return;
          fetch(API_BASE + '/users/' + uuid, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + TOKEN }
          })
          .then(() => loadUsers());
        }

        function editUser(uuid) {
          alert('ویرایش کاربر: ' + uuid + '\n(این قابلیت به‌زودی اضافه می‌شود)');
        }

        // بارگذاری اولیه
        loadUsers();
      </script>
    </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
