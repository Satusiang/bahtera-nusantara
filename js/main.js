// ====== PENGATURAN ======
// Nomor WhatsApp cadangan (format 62..., tanpa + atau 0 di depan).
// Jika Supabase sudah tersambung, nomor diambil dari pengaturan di halaman admin.
window.WA_NUMBER = window.WA_NUMBER || "6289660279551";

// Menu HP
const menu = document.getElementById('menu');
document.querySelector('.menu-btn')?.addEventListener('click', () => menu.classList.toggle('open'));

// Tombol/tautan WhatsApp (elemen dengan atribut data-wa="pesan awal")
document.querySelectorAll('[data-wa]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    openWA(el.dataset.wa || 'Halo BUMDes Bahtera Nusantara');
  });
});

function openWA(text) {
  if (!window.WA_NUMBER) { alertBox('Nomor WhatsApp belum diisi (WA_NUMBER di js/main.js). Ini masih draf.'); return; }
  const a = document.createElement('a');
  a.href = `https://wa.me/${window.WA_NUMBER}?text=${encodeURIComponent(text)}`;
  a.target = '_blank'; a.rel = 'noopener'; a.click();
}

function alertBox(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div'); t.id = 'toast';
    t.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#0c2a4d;color:#fff;padding:12px 18px;border-radius:12px;font-size:.9rem;z-index:99;max-width:90vw;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.2)';
    document.body.appendChild(t);
  }
  t.textContent = msg; t.style.display = 'block';
  clearTimeout(t._h); t._h = setTimeout(() => t.style.display = 'none', 4000);
}

// Form kontak -> WhatsApp
const f = document.getElementById('f');
f?.addEventListener('submit', e => {
  e.preventDefault();
  const v = id => document.getElementById(id).value;
  openWA(`Halo BUMDes Bahtera Nusantara,\nNama: ${v('nama')}\nKeperluan: ${v('perlu')}\n\n${v('pesan')}`);
});

// Filter galeri
window.applyGalleryFilter = function () {
  const on = document.querySelector('.filters button.on');
  const k = on ? on.dataset.f : 'semua';
  document.querySelectorAll('.gallery figure').forEach(fig => {
    fig.style.display = (k === 'semua' || fig.dataset.k === k) ? '' : 'none';
  });
};
document.querySelectorAll('.filters button').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.filters button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    window.applyGalleryFilter();
  });
});
