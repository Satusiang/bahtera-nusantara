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
  if (!u || typeof u !== 'string') return '';
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

// ---------- ikon unit usaha ----------
const S = (stroke, body) => `<svg viewBox="0 0 64 64" fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
export const IKON = {
  padi:   { bg: 'linear-gradient(135deg,#e5f7e9,#c4ecce)', svg: S('#2a8a4f', '<path d="M32 58V20"/><path d="M32 30c-8-2-12-8-12-14 7 0 12 5 12 14z"/><path d="M32 30c8-2 12-8 12-14-7 0-12 5-12 14z"/><path d="M32 44c-8-2-12-8-12-14 7 0 12 5 12 14z"/><path d="M32 44c8-2 12-8 12-14-7 0-12 5-12 14z"/><path d="M32 20V6"/>') },
  ayam:   { bg: 'linear-gradient(135deg,#fff3dc,#ffe2b0)', svg: S('#b5720a', '<ellipse cx="32" cy="38" rx="14" ry="18"/><path d="M24 30c3-2 6-2 8 0"/>') },
  ikan:   { bg: 'linear-gradient(135deg,#dff4f7,#bde6ee)', svg: S('#0e7fa6', '<path d="M8 32c8-10 22-12 34-4l12-8v24l-12-8C30 44 16 42 8 32z"/><circle cx="18" cy="30" r="1.5" fill="#0e7fa6"/>') },
  sayur:  { bg: 'linear-gradient(135deg,#eaf7df,#cdeab4)', svg: S('#4d8a1f', '<path d="M32 56c-12 0-18-10-18-20 8 0 18 6 18 20z"/><path d="M32 56c12 0 18-10 18-20-8 0-18 6-18 20z"/><path d="M32 56V22"/><path d="M32 22c-4-6-4-12 0-16 4 4 4 10 0 16z"/>') },
  ternak: { bg: 'linear-gradient(135deg,#f6ece2,#e8d3bd)', svg: S('#8a5a2b', '<path d="M14 26c0-6 4-10 10-10h16c6 0 10 4 10 10v8c0 8-6 14-14 14h-8c-8 0-14-6-14-14z"/><path d="M14 22l-6-6M50 22l6-6"/><circle cx="26" cy="30" r="1.5" fill="#8a5a2b"/><circle cx="38" cy="30" r="1.5" fill="#8a5a2b"/><path d="M26 40h12"/>') },
  toko:   { bg: 'linear-gradient(135deg,#efe9fb,#d9cdf3)', svg: S('#5b3fa6', '<path d="M10 24l4-12h36l4 12"/><path d="M10 24h44v4a6 6 0 0 1-11 3 6 6 0 0 1-11 0 6 6 0 0 1-11 0 6 6 0 0 1-11-3z"/><path d="M14 32v22h36V32"/><path d="M26 54V40h12v14"/>') },
  umum:   { bg: 'linear-gradient(135deg,#e3f1fb,#cfe6f5)', svg: S('#0c2a4d', '<circle cx="32" cy="32" r="20"/><path d="M12 32h40M32 12c6 6 8 13 8 20s-2 14-8 20c-6-6-8-13-8-20s2-14 8-20z"/>') },
};
export const STATUS_KELAS = { berjalan: 's-run', rintisan: 's-pilot', rencana: 's-plan' };

export function slug(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').slice(0, 60) || 'unit';
}
