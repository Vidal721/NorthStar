// ═══════════════════════════════════════════════
//  pb.js — PocketBase client wrapper for Team 935
// ═══════════════════════════════════════════════

const PB_URL = window.PB_URL || 'https://injured-announce-reply-lone.trycloudflare.com';

class PocketBase {
  constructor(url) {
    this.url = url;
    this.token = localStorage.getItem('pb_token') || '';
    this.user  = JSON.parse(localStorage.getItem('pb_user') || 'null');
  }

  get authHeaders() {
    return { 'Authorization': this.token, 'Content-Type': 'application/json' };
  }

  get fileHeaders() {
    return { 'Authorization': this.token };
  }

  async req(method, path, body, isForm = false) {
    const opts = { method, headers: isForm ? { 'Authorization': this.token } : this.authHeaders };
    if (body) opts.body = isForm ? body : JSON.stringify(body);
    const res = await fetch(`${this.url}/api/${path}`, opts);
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  }

  // AUTH
  async login(email, password) {
    const data = await this.req('POST', 'collections/users/auth-with-password', { identity: email, password });
    this.token = data.token;
    this.user  = data.record;
    localStorage.setItem('pb_token', this.token);
    localStorage.setItem('pb_user', JSON.stringify(this.user));
    return data;
  }

  async register(name, email, password, role) {
    const data = await this.req('POST', 'collections/users/records', {
      name, email, password, passwordConfirm: password, role
    });
    return this.login(email, password);
  }

  logout() {
    this.token = ''; this.user = null;
    localStorage.removeItem('pb_token');
    localStorage.removeItem('pb_user');
  }

  get isLoggedIn() { return !!this.token && !!this.user; }
  get isAdmin()    { return this.user && (this.user.role === 'coach' || this.user.role === 'captain'); }

  // RECORDS CRUD
  async list(col, params = {}) {
    const qs = new URLSearchParams({ perPage: 200, ...params }).toString();
    return this.req('GET', `collections/${col}/records?${qs}`);
  }

  async get(col, id, params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.req('GET', `collections/${col}/records/${id}${qs ? '?' + qs : ''}`);
  }

  async create(col, data) {
    return this.req('POST', `collections/${col}/records`, data);
  }

  async update(col, id, data) {
    return this.req('PATCH', `collections/${col}/records/${id}`, data);
  }

  async delete(col, id) {
    const res = await fetch(`${this.url}/api/collections/${col}/records/${id}`, {
      method: 'DELETE', headers: this.authHeaders
    });
    if (!res.ok) { const d = await res.json(); throw d; }
  }

  // FILE UPLOAD (multipart)
  async uploadFile(col, formData) {
    const res = await fetch(`${this.url}/api/collections/${col}/records`, {
      method: 'POST',
      headers: this.fileHeaders,
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  }

  async updateFile(col, id, formData) {
    const res = await fetch(`${this.url}/api/collections/${col}/records/${id}`, {
      method: 'PATCH',
      headers: this.fileHeaders,
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  }

  // FILE URL
  fileURL(record, fieldName, filename) {
    return `${this.url}/api/files/${record.collectionId}/${record.id}/${filename}`;
  }

  // REALTIME (simple polling fallback)
  subscribe(col, cb, interval = 3000) {
    return setInterval(async () => {
      try { const d = await this.list(col); cb(d); } catch(e) {}
    }, interval);
  }
}

window.pb = new PocketBase(PB_URL);