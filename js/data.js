// Mengisi halaman publik dengan data dari Supabase.
// Jika Supabase belum dikonfigurasi atau gagal dihubungi, isi statis di HTML tetap tampil.
import { getClient, esc, safeUrl, tanggalID, waIntl, waLocal, mapsInfo, ringkas, STATUS_KELAS, slug } from './sb.js';

const WA_ICON = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-13.5 7.8L3 21l1.2-4.5A9 9 0 1 1 21 12z"/></svg>';
const nomor = i => String(i + 1).padStart(2, '0');

const $ = (sel) => document.querySelector(sel);

function setText(key, value) {
  if (value == null || String(value).trim() === '') return; // biarkan isi bawaan
  document.querySelectorAll(`[data-bind="${key}"]`).forEach(el => { el.textContent = value; });
}

function kartuBerita(b) {
  const foto = safeUrl(b.foto_url);
  const img = foto ? `<div class="img"><img src="${esc(foto)}" alt="" loading="lazy"></div>` : '';
  return `<article><a class="card-link" href="berita.html?id=${encodeURIComponent(b.id)}">
    ${img}
    <div class="txt"><time>${esc(tanggalID(b.tanggal))}</time><h3>${esc(b.judul)}</h3><p>${esc(ringkas(b.isi))}</p></div>
  </a></article>`;
}

// Alamat untuk pencarian peta: buang RT/RW (membingungkan Google) dan lengkapi wilayah
function alamatUntukPeta(alamat) {
  let a = String(alamat).replace(/\bRT\.?\s*\d+\s*\/?\s*(RW\.?\s*\d+)?/gi, ' ').replace(/\bRW\.?\s*\d+/gi, ' ');
  a = a.replace(/\s+,/g, ',').replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').trim().replace(/^,|,$/g, '');
  if (!/bekasi/i.test(a)) a += ', Kabupaten Bekasi';
  if (!/jawa barat/i.test(a)) a += ', Jawa Barat';
  return a;
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
  // Lengkapi kabupaten bila admin belum menuliskannya
  if (k.alamat && !/bekasi/i.test(k.alamat)) setText('alamat', `${k.alamat.trim().replace(/,$/, '')}, Kab. Bekasi`);
  else setText('alamat', k.alamat);
  setText('jam', k.jam);
  const peta = $('#peta');
  const mp = mapsInfo(k.maps_embed);
  // Link pendek (maps.app.goo.gl) atau isian kosong tidak bisa disematkan:
  // tampilkan peta berdasarkan alamat kantor; tombol tetap memakai link dari admin.
  if (!mp.embed && k.alamat) {
    const dariAlamat = mapsInfo(alamatUntukPeta(k.alamat));
    mp.embed = dariAlamat.embed;
    mp.link = mp.link || dariAlamat.link;
  }
  if (peta && (mp.embed || mp.link)) {
    peta.hidden = false;
    const tombol = mp.link ? `<a class="btn map-btn" href="${esc(mp.link)}" target="_blank" rel="noopener">Buka di Google Maps</a>` : '';
    if (mp.embed) {
      peta.innerHTML = `<iframe src="${esc(mp.embed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Peta lokasi BUM Desa" allowfullscreen></iframe>${tombol}`;
      peta.classList.add('has-map');
    } else {
      peta.innerHTML = `<b style="color:var(--navy)">Lokasi kantor BUM Desa</b>${tombol}`;
    }
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
  if (terbaru) {
    terbaru.innerHTML = data.slice(0, 3).map(kartuBerita).join('');
    const sec = $('#kabar');
    if (sec) sec.hidden = false;
  }
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
  document.addEventListener('keydown', e => { if (e.key === 'Escape') lb.classList.remove('on'); });
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

  const status = u => u.status ? `<span class="status ${STATUS_KELAS[u.status_jenis] || 's-run'}">${esc(u.status)}</span>` : '';

  if (ringkas) {
    ringkas.innerHTML = data.slice(0, 6).map((u, i) => `
      <a class="unit-row" href="usaha.html#${esc(slug(u.nama))}"><span class="no">${nomor(i)}</span><div class="name"><h3>${esc(u.nama)}</h3>${status(u)}</div><p>${esc(u.ringkasan || ringkas_(u.deskripsi))}</p></a>`).join('');
  }
  if (list) {
    const lokasiPer = await muatLokasi(sb, data.map(u => u.id));
    list.innerHTML = data.map((u, i) => {
      const fakta = (Array.isArray(u.fakta) ? u.fakta : []).filter(f => f && (f.label || f.nilai));
      const foto = safeUrl(u.foto_url);
      return `
      <article class="unit-detail" id="${esc(slug(u.nama))}">
        <div class="side"><span class="no">${nomor(i)}</span><h2>${esc(u.nama)}</h2>${status(u)}</div>
        <div class="main">
          ${foto ? `<div class="foto"><img src="${esc(foto)}" alt="${esc(u.nama)}" loading="lazy"></div>` : ''}
          ${paragraf(u.deskripsi || u.ringkasan)}
          ${fakta.length ? `<div class="facts">${fakta.map(f => `<div><small>${esc(f.label)}</small><b>${esc(f.nilai)}</b></div>`).join('')}</div>` : ''}
          <a class="btn wa" href="#" data-wa="${esc(u.wa_pesan || `Halo BUM Desa Bahtera Nusantara, saya ingin bertanya tentang ${u.nama}.`)}">${WA_ICON}Tanya lewat WhatsApp</a>
        </div>
        ${daftarLokasi(u, lokasiPer[u.id] || [])}
      </article>`;
    }).join('');
    aktifkanLokasi(list);
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target && target.tagName === 'DETAILS') target.open = true;
      target?.scrollIntoView();
    }
  }
}

// ---------- lokasi usaha (kolam / kandang / petak) ----------
async function muatLokasi(sb, unitIds) {
  if (!unitIds.length) return {};
  const { data, error } = await sb.from('lokasi').select('*, wadah(*)')
    .in('unit_id', unitIds).eq('tampil', true).order('urutan').order('dibuat');
  if (error || !data) return {}; // tabel belum dibuat: halaman tetap tampil tanpa lokasi
  const per = {};
  data.forEach(l => { (per[l.unit_id] ||= []).push(l); });
  return per;
}

const unik = arr => [...new Set(arr.map(x => String(x || '').trim()).filter(Boolean))];
const angkaID = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
const kg = v => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? '' : `${angkaID.format(Number(v))} kg`;
const hariIni = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

// Ringkasan panen satu lokasi: total estimasi kg dan tanggal panen terdekat (yang belum lewat)
function ringkasPanen(w) {
  const angka = w.map(x => Number(x.estimasi_kg)).filter(n => !isNaN(n) && n > 0);
  const total = w.reduce((t, x) => t + (Number(x.estimasi_kg) > 0 ? Number(x.estimasi_kg) : 0), 0);
  const tgl = w.map(x => x.estimasi_panen).filter(Boolean).sort();
  const depan = tgl.find(t => t >= hariIni()) || '';
  return { total: angka.length ? total : 0, terdekat: depan };
}

function daftarLokasi(u, lokasi) {
  if (!lokasi.length) return '';
  const istilah = (u.istilah || 'Kolam').trim();
  const kecil = istilah.toLowerCase();
  const total = lokasi.reduce((n, l) => n + (l.wadah || []).length, 0);
  return `
        <div class="lokasi-wrap">
          <h3 class="lokasi-head">Lokasi ${esc(kecil)} <small>${lokasi.length} lokasi · ${total} ${esc(kecil)}</small></h3>
          <div class="lokasi-list">${lokasi.map(l => kartuLokasi(u, l, istilah)).join('')}</div>
        </div>`;
}

function kartuLokasi(u, l, istilah) {
  const kecil = istilah.toLowerCase();
  const labelKom = (u.label_komoditas || 'Jenis ikan').trim();
  const w = [...(l.wadah || [])].sort((a, b) => (a.urutan - b.urutan) || String(a.dibuat).localeCompare(String(b.dibuat)));
  const kom = unik(w.map(x => x.komoditas));
  const jenis = unik(w.map(x => x.jenis));
  const metode = unik(w.map(x => x.metode));
  const panen = ringkasPanen(w);
  const foto = safeUrl(l.foto_url);
  const mp = mapsInfo(l.maps);
  const id = `${slug(u.nama)}-${slug(l.nama)}`;
  const st = l.status ? `<span class="status ${STATUS_KELAS[l.status_jenis] || 's-run'}">${esc(l.status)}</span>` : '';
  const baris = (label, nilai) => nilai ? `<div><dt>${esc(label)}</dt><dd>${esc(nilai)}</dd></div>` : '';
  const tabel = w.length ? `
            <div class="wadah-scroll"><table class="wadah">
              <thead><tr><th>${esc(istilah)}</th><th>Jenis ${esc(kecil)}</th><th>Ukuran</th><th>Metode budidaya</th><th>${esc(labelKom)}</th><th>Estimasi panen</th><th>Perkiraan tanggal panen</th></tr></thead>
              <tbody>${w.map((x, i) => `<tr>
                <td data-label="${esc(istilah)}"><b>${esc(x.nama || `${istilah} ${i + 1}`)}</b></td>
                <td data-label="Jenis ${esc(kecil)}">${esc(x.jenis) || '–'}</td>
                <td data-label="Ukuran">${esc(x.ukuran) || '–'}</td>
                <td data-label="Metode budidaya">${esc(x.metode) || '–'}</td>
                <td data-label="${esc(labelKom)}">${esc(x.komoditas) || '–'}</td>
                <td data-label="Estimasi panen" class="num">${esc(kg(x.estimasi_kg)) || '–'}</td>
                <td data-label="Perkiraan tanggal panen">${esc(tanggalID(x.estimasi_panen)) || '–'}</td></tr>`).join('')}</tbody>
            </table></div>` : `<p class="note">Belum ada data ${esc(kecil)} di lokasi ini.</p>`;
  const peta = (mp.embed || mp.link) ? `
            <div class="l-map${mp.embed ? '' : ' no-embed'}">
              ${mp.embed ? `<iframe data-src="${esc(mp.embed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Peta ${esc(l.nama)}" allowfullscreen></iframe>` : ''}
              ${mp.link ? `<a class="btn line small" href="${esc(mp.link)}" target="_blank" rel="noopener">Buka di Google Maps</a>` : ''}
            </div>` : '';
  return `
          <details class="lokasi" id="${esc(id)}">
            <summary>
              <span class="l-title"><b>${esc(l.nama)}</b><small>${w.length} ${esc(kecil)}${kom.length ? ` · ${esc(kom.join(', '))}` : ''}${panen.total ? ` · ± ${esc(kg(panen.total))}` : ''}</small></span>
              ${st}
              <span class="l-chev" aria-hidden="true"></span>
            </summary>
            <div class="l-body">
              <div class="l-info">
                ${foto ? `<div class="l-foto"><img src="${esc(foto)}" alt="Lokasi ${esc(l.nama)}" loading="lazy"></div>` : ''}
                <dl class="l-dl">
                  ${baris('Pengelola', l.pengelola)}
                  ${baris(`Jumlah ${kecil}`, String(w.length))}
                  ${baris(`Jenis ${kecil}`, jenis.join(', '))}
                  ${baris('Metode budidaya', metode.join(', '))}
                  ${baris(labelKom, kom.join(', '))}
                  ${baris('Estimasi hasil panen', panen.total ? `± ${kg(panen.total)}` : '')}
                  ${baris('Panen terdekat', panen.terdekat ? tanggalID(panen.terdekat) : '')}
                </dl>
              </div>
              ${l.keterangan ? `<div class="l-ket">${paragraf(l.keterangan)}</div>` : ''}
              ${tabel}
              ${peta}
            </div>
          </details>`;
}

// Peta dimuat saat kartu dibuka; alamat halaman ikut berubah agar bisa dibagikan
function aktifkanLokasi(root) {
  root.addEventListener('toggle', e => {
    const d = e.target;
    if (!(d instanceof HTMLDetailsElement) || !d.classList.contains('lokasi') || !d.open) return;
    d.querySelectorAll('iframe[data-src]').forEach(f => { f.src = f.dataset.src; f.removeAttribute('data-src'); });
    history.replaceState(null, '', '#' + d.id);
  }, true);
}
const ringkas_ = t => ringkas(t, 120);

async function muatTransparansi(sb) {
  const tabel = $('#ringkasan-tabel');
  if (!tabel && !document.querySelector('[data-bind="tr-catatan"]')) return;
  const { data, error } = await sb.from('pengaturan').select('nilai').eq('kunci', 'transparansi').maybeSingle();
  if (error || !data) return;
  const t = data.nilai || {};
  const kolom = Array.isArray(t.kolom) ? t.kolom : [];
  const baris = Array.isArray(t.baris) ? t.baris : [];
  // Tabel hanya ditampilkan bila sudah ada angka yang diisi admin
  const adaAngka = baris.some(b => (Array.isArray(b.nilai) ? b.nilai : []).some(v => String(v ?? '').trim()));
  if (adaAngka) setText('tr-catatan', t.catatan || 'Ringkasan keuangan berdasarkan laporan pertanggungjawaban yang telah disahkan.');
  else setText('tr-catatan', t.catatan);
  if (!tabel || !adaAngka) return;
  tabel.closest('.table-scroll').hidden = false;
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
