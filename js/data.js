// Mengisi halaman publik dengan data dari Supabase.
// Jika Supabase belum dikonfigurasi atau gagal dihubungi, isi statis di HTML tetap tampil.
import { getClient, esc, safeUrl, tanggalID, waIntl, waLocal, mapsSrc, ringkas } from './sb.js';

const $ = (sel) => document.querySelector(sel);

function setText(key, value) {
  if (value == null || String(value).trim() === '') return; // biarkan isi bawaan
  document.querySelectorAll(`[data-bind="${key}"]`).forEach(el => { el.textContent = value; });
}

function kartuBerita(b) {
  const foto = safeUrl(b.foto_url);
  const img = foto ? `<img src="${esc(foto)}" alt="" loading="lazy">` : 'BUMDes Bahtera Nusantara';
  return `<article><a class="card-link" href="berita.html?id=${encodeURIComponent(b.id)}">
    <div class="img">${img}</div>
    <div class="txt"><time>${esc(tanggalID(b.tanggal))}</time><h3>${esc(b.judul)}</h3><p>${esc(ringkas(b.isi))}</p></div>
  </a></article>`;
}

async function muatPengaturan(sb) {
  const { data, error } = await sb.from('pengaturan').select('kunci,nilai');
  if (error || !data) return;
  const cfg = Object.fromEntries(data.map(r => [r.kunci, r.nilai || {}]));
  const k = cfg.kontak || {};
  const p = cfg.profil || {};

  if (k.wa) {
    window.WA_NUMBER = waIntl(k.wa);
    document.querySelectorAll('[data-bind="wa"]').forEach(a => {
      a.textContent = waLocal(k.wa);
      a.href = `https://wa.me/${window.WA_NUMBER}`;
    });
  }
  if (k.email) {
    document.querySelectorAll('[data-bind="email"]').forEach(a => {
      a.textContent = k.email;
      a.href = `mailto:${k.email}`;
    });
  }
  setText('alamat', k.alamat);
  setText('jam', k.jam);
  const peta = $('#peta');
  const src = mapsSrc(k.maps_embed);
  if (peta && src) {
    peta.innerHTML = `<iframe src="${esc(src)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Peta lokasi BUMDes"></iframe>`;
    peta.style.padding = '0';
  }

  setText('sejarah', p.sejarah);
  setText('visi', p.visi);
  setText('npwp', p.npwp);
  setText('nib', p.nib);
  const misi = $('#misi');
  if (misi && Array.isArray(p.misi) && p.misi.filter(Boolean).length) {
    misi.innerHTML = p.misi.filter(Boolean).map(m => `<li>${esc(m)}</li>`).join('');
  }
}

async function muatPengurus(sb) {
  const el = $('#pengurus');
  if (!el) return;
  const { data, error } = await sb.from('pengurus').select('*').order('urutan').order('dibuat');
  if (error || !data || !data.length) return;
  el.innerHTML = data.map(o => {
    const foto = safeUrl(o.foto_url);
    const av = foto ? `<img src="${esc(foto)}" alt="${esc(o.nama)}" loading="lazy">` : esc((o.nama || '?').trim().charAt(0).toUpperCase());
    return `<div class="person"><div class="avatar">${av}</div><b>${esc(o.nama)}</b><small>${esc(o.jabatan)}</small></div>`;
  }).join('');
}

async function muatBerita(sb) {
  const terbaru = $('#berita-terbaru');
  const list = $('#berita-list');
  if (!terbaru && !list) return;
  const q = sb.from('berita').select('id,judul,isi,tanggal,foto_url').eq('terbit', true)
    .order('tanggal', { ascending: false }).order('dibuat', { ascending: false });
  const { data, error } = await (terbaru && !list ? q.limit(3) : q);
  if (error || !data || !data.length) return;
  if (terbaru) terbaru.innerHTML = data.slice(0, 3).map(kartuBerita).join('');
  if (list) list.innerHTML = data.map(kartuBerita).join('');
}

async function muatDetailBerita(sb) {
  const el = $('#berita-detail');
  if (!el) return;
  const id = new URLSearchParams(location.search).get('id');
  if (!id) { el.innerHTML = '<p class="lead">Berita tidak ditemukan.</p>'; return; }
  const { data, error } = await sb.from('berita').select('*').eq('id', id).maybeSingle();
  if (error || !data) { el.innerHTML = '<p class="lead">Berita tidak ditemukan.</p>'; return; }
  document.title = `${data.judul} – BUMDes Bahtera Nusantara`;
  const foto = safeUrl(data.foto_url);
  const paragraf = String(data.isi || '').split(/\n\s*\n/).map(t => t.trim()).filter(Boolean)
    .map(t => `<p>${esc(t).replace(/\n/g, '<br>')}</p>`).join('');
  el.innerHTML = `<time>${esc(tanggalID(data.tanggal))}</time><h1>${esc(data.judul)}</h1>
    ${foto ? `<img class="cover" src="${esc(foto)}" alt="">` : ''}${paragraf}`;
}

async function muatGaleri(sb) {
  const el = $('#galeri');
  if (!el) return;
  const { data, error } = await sb.from('galeri').select('*').order('dibuat', { ascending: false });
  if (error || !data || !data.length) return;
  el.innerHTML = data.map(g => {
    const foto = safeUrl(g.foto_url);
    if (!foto) return '';
    return `<figure data-k="${esc(g.kategori)}" data-src="${esc(foto)}"><img src="${esc(foto)}" alt="${esc(g.keterangan)}" loading="lazy"><figcaption>${esc(g.keterangan)}</figcaption></figure>`;
  }).join('');
  if (window.applyGalleryFilter) window.applyGalleryFilter();

  // Lightbox sederhana
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = '<img alt=""><p></p>';
  document.body.appendChild(lb);
  lb.addEventListener('click', () => lb.classList.remove('on'));
  el.addEventListener('click', e => {
    const fig = e.target.closest('figure[data-src]');
    if (!fig) return;
    lb.querySelector('img').src = fig.dataset.src;
    lb.querySelector('p').textContent = fig.querySelector('figcaption')?.textContent || '';
    lb.classList.add('on');
  });
}

async function muatDokumen(sb) {
  const el = $('#dokumen-list');
  if (!el) return;
  const { data, error } = await sb.from('dokumen').select('*').order('urutan').order('dibuat', { ascending: false });
  if (error || !data || !data.length) return;
  el.innerHTML = data.map(d => {
    const url = safeUrl(d.file_url);
    return `<div class="doc"><div><b>${esc(d.judul)}</b>${d.keterangan ? `<small>${esc(d.keterangan)}</small>` : ''}</div>
      ${url ? `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Unduh</a>` : ''}</div>`;
  }).join('');
}

(async () => {
  let sb;
  try { sb = await getClient(); } catch (e) { console.warn('Supabase tidak dapat dimuat', e); return; }
  if (!sb) {
    const d = $('#berita-detail');
    if (d) d.innerHTML = '<p class="lead">Berita belum tersedia.</p>';
    return;
  }
  const tugas = [muatPengaturan, muatPengurus, muatBerita, muatDetailBerita, muatGaleri, muatDokumen];
  await Promise.all(tugas.map(f => f(sb).catch(e => console.warn(f.name, e))));
})();
