// Penghubung ke Supabase, dipakai halaman publik dan halaman admin.
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

let clientPromise = null;

export function isConfigured() {
  const c = window.BUMDES_CONFIG || {};
  return Boolean(window.__SB_MOCK || (c.supabaseUrl && c.supabaseAnonKey));
}

export function getClient() {
  if (window.__SB_MOCK) return Promise.resolve(window.__SB_MOCK); // untuk pengujian
  if (!isConfigured()) return Promise.resolve(null);
  if (!clientPromise) {
    const c = window.BUMDES_CONFIG;
    clientPromise = import(SUPABASE_JS).then(({ createClient }) =>
      createClient(c.supabaseUrl, c.supabaseAnonKey));
  }
  return clientPromise;
}

// ---------- utilitas tampilan ----------
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// Hanya izinkan URL http(s) agar tidak bisa disusupi javascript:
export function safeUrl(u) {
  try {
    const url = new URL(u, location.href);
    return (url.protocol === 'https:' || url.protocol === 'http:') ? url.href : '';
  } catch { return ''; }
}

const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
export function tanggalID(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${d} ${BULAN[m - 1]} ${y}`;
}

// Nomor lokal 08xx -> 628xx untuk link WhatsApp
export function waIntl(n) {
  let d = String(n || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  return d;
}
export function waLocal(n) {
  let d = String(n || '').replace(/\D/g, '');
  if (d.startsWith('62')) d = '0' + d.slice(2);
  return d.replace(/^(\d{4})(\d{4})(\d+)$/, '$1-$2-$3');
}

// Ambil src dari kode sematan Google Maps; hanya terima google.com/maps/embed
export function mapsSrc(code) {
  const m = String(code || '').match(/src=["']([^"']+)["']/);
  const src = m ? m[1] : String(code || '').trim();
  try {
    const u = new URL(src);
    if (u.protocol === 'https:' && /(^|\.)google\.[a-z.]+$/.test(u.hostname) && u.pathname.startsWith('/maps/embed')) return u.href;
  } catch { /* abaikan */ }
  return '';
}

export function ringkas(teks, n = 140) {
  const t = String(teks || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t;
}
