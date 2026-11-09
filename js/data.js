// Mengisi halaman publik dengan data dari Supabase.
// Jika Supabase belum dikonfigurasi atau gagal dihubungi, isi statis di HTML tetap tampil.
import { getClient, esc, safeUrl, tanggalID, waIntl, waLocal, mapsSrc, ringkas, IKON, STATUS_KELAS, slug } from './sb.js';

const $ = (sel) => document.querySelector(sel);

function setText(key, value) {
  if (value == null || String(value).trim() === '') return; // biarkan isi bawaan
  document.querySelectorAll(`[data-bind="${key}"]`).forEach(el => { el.textContent = value; });
}

function kartuBerita(b) {
  const foto = safeUrl(b.foto_url);
  const img = foto ? `<img src="${esc(foto)}" alt="" loading="lazy">` : 'BUM Desa Bahtera Nusantara';
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
    peta.innerHTML = `<iframe src="${esc(src)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Peta lokasi BUM Desa"></iframe>`;
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
  document.title = `${data.judul} – BUM Desa Bahtera Nusantara`;
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


function paragraf(teks) {
  return String(teks || '').split(/\n\s*\n/).map(t => t.trim()).filter(Boolean)
    .map(t => `<p>${esc(t).replace(/\n/g, '<br>')}</p>`).join('');
}

async function muatUnitUsaha(sb) {
  const ringkas = $('#unit-ringkas');
  const list = $('#unit-list');
  const jumlah = document.querySelectorAll('[data-bind="jumlah-unit"]');
  if (!ringkas && !list && !jumlah.length) return;
  const { data, error } = await sb.from('unit_usaha').select('*').eq('tampil', true).order('urutan').order('dibuat');
  if (error || !data || !data.length) return;
  jumlah.forEach(el => { el.textContent = `${data.length} bidang`; });

  const visual = (u, cls) => {
    const ik = IKON[u.ikon] || IKON.umum;
    const foto = safeUrl(u.foto_url);
    return foto
      ? `<div class="${cls} has-foto"><img src="${esc(foto)}" alt="${esc(u.nama)}" loading="lazy"></div>`
      : `<div class="${cls}" style="background:${ik.bg}">${ik.svg}</div>`;
  };
  const status = u => u.status ? `<span class="status ${STATUS_KELAS[u.status_jenis] || 's-run'}">${esc(u.status)}</span>` : '';

  if (ringkas) {
    ringkas.innerHTML = data.slice(0, 6).map(u => `
      <div class="unit">${visual(u, 'top')}
        <div class="body">${status(u)}<h3>${esc(u.nama)}</h3><p>${esc(u.ringkasan || ringkas_(u.deskripsi))}</p>
          <a class="more" href="usaha.html#${esc(slug(u.nama))}">Detail →</a></div>
      </div>`).join('');
  }
  if (list) {
    list.innerHTML = data.map((u, i) => {
      const fakta = (Array.isArray(u.fakta) ? u.fakta : []).filter(f => f && (f.label || f.nilai));
      return `
      <div class="unit-detail${i % 2 ? ' flip' : ''}" id="${esc(slug(u.nama))}">
        ${visual(u, 'visual')}
        <div>
          ${status(u)}
          <h3>${esc(u.nama)}</h3>
          ${paragraf(u.deskripsi || u.ringkasan)}
          ${fakta.length ? `<div class="facts">${fakta.map(f => `<div><small>${esc(f.label)}</small><b>${esc(f.nilai)}</b></div>`).join('')}</div>` : ''}
          <a class="btn" href="#" data-wa="${esc(u.wa_pesan || `Halo BUM Desa Bahtera Nusantara, saya ingin bertanya tentang ${u.nama}.`)}">Tanya via WhatsApp</a>
        </div>
      </div>`;
    }).join('');
    if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  }
}
const ringkas_ = t => ringkas(t, 120);

async function muatTransparansi(sb) {
  const tabel = $('#ringkasan-tabel');
  if (!tabel && !document.querySelector('[data-bind="tr-catatan"]')) return;
  const { data, error } = await sb.from('pengaturan').select('nilai').eq('kunci', 'transparansi').maybeSingle();
  if (error || !data) return;
  const t = data.nilai || {};
  setText('tr-catatan', t.catatan);
  const kolom = Array.isArray(t.kolom) ? t.kolom : [];
  const baris = Array.isArray(t.baris) ? t.baris : [];
  if (!tabel || !baris.length) return;
  tabel.innerHTML = `<thead><tr><th>Uraian</th>${kolom.map(k => `<th style="text-align:right">${esc(k)}</th>`).join('')}</tr></thead>
    <tbody>${baris.map(b => {
      const v = Array.isArray(b.nilai) ? b.nilai : [];
      const w = x => b.tebal ? `<b>${x}</b>` : x;
      return `<tr><td>${w(esc(b.uraian))}</td>${kolom.map((_, i) => `<td class="num">${w(esc(v[i] ?? '') || '–')}</td>`).join('')}</tr>`;
    }).join('')}</tbody>`;
}

(async () => {
  let sb;
  try { sb = await getClient(); } catch (e) { console.warn('Supabase tidak dapat dimuat', e); return; }
  if (!sb) {
    const d = $('#berita-detail');
    if (d) d.innerHTML = '<p class="lead">Berita belum tersedia.</p>';
    return;
  }
  const tugas = [muatPengaturan, muatPengurus, muatBerita, muatDetailBerita, muatGaleri, muatDokumen, muatUnitUsaha, muatTransparansi];
  await Promise.all(tugas.map(f => f(sb).catch(e => console.warn(f.name, e))));
})();
