import { getClient, isConfigured, esc, safeUrl, tanggalID, waLocal, IKON } from '../js/sb.js';

const $ = (s) => document.querySelector(s);
const BUCKET = 'media';
let sb;

// ---------- utilitas ----------
function toast(msg, isErr = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast' + (isErr ? ' err' : '');
  t.style.display = 'block';
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.style.display = 'none'), isErr ? 6000 : 3000);
}

function show(view) {
  ['noconfig', 'login', 'denied', 'app'].forEach(v => { $('#v-' + v).hidden = v !== view; });
}

async function busy(btn, fn) {
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Menyimpan…';
  try { await fn(); }
  catch (e) { console.error(e); toast('Gagal: ' + (e.message || e), true); }
  finally { btn.disabled = false; btn.textContent = label; }
}

function check({ error, data }) {
  if (error) throw new Error(error.message);
  return data;
}

// Kecilkan foto di browser sebelum diunggah (lebar maks 1600 px, JPEG)
async function kompres(file, maxW = 1600, quality = 0.82) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('Foto tidak bisa dibaca'));
    i.src = URL.createObjectURL(file);
  });
  const scale = Math.min(1, maxW / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(img.src);
  return await new Promise(res => c.toBlob(b => res(b || file), 'image/jpeg', quality));
}

async function unggah(file, folder, { image = true } = {}) {
  const blob = image ? await kompres(file) : file;
  const ext = image ? 'jpg' : (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  check(await sb.storage.from(BUCKET).upload(path, blob, {
    contentType: image ? 'image/jpeg' : (file.type || 'application/octet-stream'),
    upsert: false,
  }));
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function hapusFile(url) {
  const m = String(url || '').match(/\/object\/public\/media\/(.+)$/);
  if (!m) return;
  try { await sb.storage.from(BUCKET).remove([decodeURIComponent(m[1])]); } catch { /* abaikan */ }
}

function previewFile(input, box) {
  input.addEventListener('change', () => {
    const f = input.files[0];
    box.innerHTML = f ? `<img src="${URL.createObjectURL(f)}" alt="">` : '';
  });
}

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

// ---------- tab ----------
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.tab').forEach(t => { t.hidden = t.id !== 't-' + b.dataset.tab; });
}));

// ================= BERITA =================
let beritaCache = [];
function resetBerita() {
  $('#f-berita').reset();
  $('#b-id').value = '';
  $('#b-tanggal').value = today();
  $('#b-preview').innerHTML = '';
  $('#berita-title').textContent = 'Tulis berita baru';
}
async function muatBerita() {
  beritaCache = check(await sb.from('berita').select('*').order('tanggal', { ascending: false }).order('dibuat', { ascending: false }));
  $('#l-berita').innerHTML = beritaCache.length ? beritaCache.map(b => `
    <div class="item">
      ${safeUrl(b.foto_url) ? `<img src="${esc(b.foto_url)}" alt="">` : '<span class="noimg"></span>'}
      <div class="meta"><b>${esc(b.judul)}</b>
        <small>${esc(tanggalID(b.tanggal))}</small>
        <span class="badge ${b.terbit ? 'on' : 'off'}">${b.terbit ? 'Terbit' : 'Draf'}</span></div>
      <div class="acts">
        <button class="btn alt small" data-edit="${b.id}">Edit</button>
        <button class="btn danger small" data-del="${b.id}">Hapus</button>
      </div>
    </div>`).join('') : '<p class="empty">Belum ada berita.</p>';
}
$('#l-berita').addEventListener('click', async e => {
  const id = e.target.dataset.edit || e.target.dataset.del;
  const b = beritaCache.find(x => x.id === id);
  if (!b) return;
  if (e.target.dataset.edit) {
    $('#b-id').value = b.id;
    $('#b-judul').value = b.judul;
    $('#b-tanggal').value = b.tanggal;
    $('#b-isi').value = b.isi || '';
    $('#b-terbit').checked = b.terbit;
    $('#b-foto').value = '';
    $('#b-preview').innerHTML = safeUrl(b.foto_url) ? `<img src="${esc(b.foto_url)}" alt="">` : '';
    $('#berita-title').textContent = 'Edit berita';
    $('#f-berita').scrollIntoView({ behavior: 'smooth' });
  } else if (confirm(`Hapus berita "${b.judul}"?`)) {
    await busy(e.target, async () => {
      check(await sb.from('berita').delete().eq('id', b.id));
      await hapusFile(b.foto_url);
      toast('Berita dihapus');
      await muatBerita();
    });
  }
});
$('#b-reset').addEventListener('click', resetBerita);
previewFile($('#b-foto'), $('#b-preview'));
$('#f-berita').addEventListener('submit', e => {
  e.preventDefault();
  busy(e.submitter || $('#f-berita button[type=submit]'), async () => {
    const id = $('#b-id').value;
    const lama = beritaCache.find(x => x.id === id);
    const row = {
      judul: $('#b-judul').value.trim(),
      tanggal: $('#b-tanggal').value,
      isi: $('#b-isi').value,
      terbit: $('#b-terbit').checked,
    };
    const f = $('#b-foto').files[0];
    if (f) row.foto_url = await unggah(f, 'berita');
    if (id) check(await sb.from('berita').update(row).eq('id', id));
    else check(await sb.from('berita').insert(row));
    if (f && lama?.foto_url) await hapusFile(lama.foto_url);
    toast(id ? 'Berita diperbarui' : 'Berita disimpan');
    resetBerita();
    await muatBerita();
  });
});

// ================= GALERI =================
let galeriCache = [];
const KAT = ['umum', 'padi', 'ayam', 'ikan'];
async function muatGaleri() {
  galeriCache = check(await sb.from('galeri').select('*').order('dibuat', { ascending: false }));
  $('#l-galeri').innerHTML = galeriCache.length ? galeriCache.map(g => `
    <div class="gal-item" data-id="${g.id}">
      <img src="${esc(safeUrl(g.foto_url))}" alt="" loading="lazy">
      <div class="f">
        <input value="${esc(g.keterangan)}" maxlength="140" placeholder="Keterangan" data-k="ket">
        <select data-k="kat">${KAT.map(k => `<option value="${k}" ${k === g.kategori ? 'selected' : ''}>${k[0].toUpperCase() + k.slice(1)}</option>`).join('')}</select>
        <div class="acts">
          <button class="btn alt small" data-save>Simpan</button>
          <button class="btn danger small" data-del>Hapus</button>
        </div>
      </div>
    </div>`).join('') : '<p class="empty">Belum ada foto.</p>';
}
$('#l-galeri').addEventListener('click', async e => {
  const card = e.target.closest('.gal-item');
  if (!card) return;
  const g = galeriCache.find(x => x.id === card.dataset.id);
  if (e.target.hasAttribute('data-save')) {
    await busy(e.target, async () => {
      check(await sb.from('galeri').update({
        keterangan: card.querySelector('[data-k=ket]').value.trim(),
        kategori: card.querySelector('[data-k=kat]').value,
      }).eq('id', g.id));
      toast('Foto diperbarui');
    });
  } else if (e.target.hasAttribute('data-del') && confirm('Hapus foto ini dari galeri?')) {
    await busy(e.target, async () => {
      check(await sb.from('galeri').delete().eq('id', g.id));
      await hapusFile(g.foto_url);
      toast('Foto dihapus');
      await muatGaleri();
    });
  }
});
$('#f-galeri').addEventListener('submit', e => {
  e.preventDefault();
  busy(e.submitter || $('#f-galeri button[type=submit]'), async () => {
    const files = [...$('#g-files').files];
    const prog = $('#g-progress');
    for (let i = 0; i < files.length; i++) {
      prog.textContent = `Mengunggah ${i + 1} dari ${files.length}…`;
      const url = await unggah(files[i], 'galeri');
      check(await sb.from('galeri').insert({ foto_url: url, kategori: $('#g-kat').value, keterangan: $('#g-ket').value.trim() }));
    }
    prog.textContent = '';
    $('#f-galeri').reset();
    toast(`${files.length} foto diunggah`);
    await muatGaleri();
  });
});

// ================= PENGURUS =================
let pengurusCache = [];
function resetPengurus() {
  $('#f-pengurus').reset();
  $('#p-id').value = '';
  $('#p-preview').innerHTML = '';
  $('#pengurus-title').textContent = 'Tambah pengurus';
}
async function muatPengurus() {
  pengurusCache = check(await sb.from('pengurus').select('*').order('urutan').order('dibuat'));
  $('#l-pengurus').innerHTML = pengurusCache.length ? pengurusCache.map(p => `
    <div class="item">
      ${safeUrl(p.foto_url) ? `<img src="${esc(p.foto_url)}" alt="">` : '<span class="noimg"></span>'}
      <div class="meta"><b>${esc(p.nama)}</b><small>${esc(p.jabatan)} · urutan ${p.urutan}</small></div>
      <div class="acts">
        <button class="btn alt small" data-edit="${p.id}">Edit</button>
        <button class="btn danger small" data-del="${p.id}">Hapus</button>
      </div>
    </div>`).join('') : '<p class="empty">Belum ada pengurus.</p>';
}
$('#l-pengurus').addEventListener('click', async e => {
  const id = e.target.dataset.edit || e.target.dataset.del;
  const p = pengurusCache.find(x => x.id === id);
  if (!p) return;
  if (e.target.dataset.edit) {
    $('#p-id').value = p.id;
    $('#p-nama').value = p.nama;
    $('#p-jabatan').value = p.jabatan;
    $('#p-urutan').value = p.urutan;
    $('#p-foto').value = '';
    $('#p-preview').innerHTML = safeUrl(p.foto_url) ? `<img src="${esc(p.foto_url)}" alt="">` : '';
    $('#pengurus-title').textContent = 'Edit pengurus';
    $('#f-pengurus').scrollIntoView({ behavior: 'smooth' });
  } else if (confirm(`Hapus ${p.nama} dari susunan pengurus?`)) {
    await busy(e.target, async () => {
      check(await sb.from('pengurus').delete().eq('id', p.id));
      await hapusFile(p.foto_url);
      toast('Pengurus dihapus');
      await muatPengurus();
    });
  }
});
$('#p-reset').addEventListener('click', resetPengurus);
previewFile($('#p-foto'), $('#p-preview'));
$('#f-pengurus').addEventListener('submit', e => {
  e.preventDefault();
  busy(e.submitter || $('#f-pengurus button[type=submit]'), async () => {
    const id = $('#p-id').value;
    const lama = pengurusCache.find(x => x.id === id);
    const row = {
      nama: $('#p-nama').value.trim(),
      jabatan: $('#p-jabatan').value.trim(),
      urutan: parseInt($('#p-urutan').value, 10) || 0,
    };
    const f = $('#p-foto').files[0];
    if (f) row.foto_url = await unggah(f, 'pengurus');
    if (id) check(await sb.from('pengurus').update(row).eq('id', id));
    else check(await sb.from('pengurus').insert(row));
    if (f && lama?.foto_url) await hapusFile(lama.foto_url);
    toast('Data pengurus disimpan');
    resetPengurus();
    await muatPengurus();
  });
});

// ================= DOKUMEN =================
let dokumenCache = [];
async function muatDokumen() {
  dokumenCache = check(await sb.from('dokumen').select('*').order('urutan').order('dibuat', { ascending: false }));
  $('#l-dokumen').innerHTML = dokumenCache.length ? dokumenCache.map(d => `
    <div class="item">
      <div class="meta"><b>${esc(d.judul)}</b><small>${esc(d.keterangan)} · urutan ${d.urutan}</small></div>
      <div class="acts">
        <a class="btn alt small" href="${esc(safeUrl(d.file_url))}" target="_blank" rel="noopener">Lihat</a>
        <button class="btn danger small" data-del="${d.id}">Hapus</button>
      </div>
    </div>`).join('') : '<p class="empty">Belum ada dokumen.</p>';
}
$('#l-dokumen').addEventListener('click', async e => {
  const d = dokumenCache.find(x => x.id === e.target.dataset.del);
  if (!d || !confirm(`Hapus dokumen "${d.judul}"?`)) return;
  await busy(e.target, async () => {
    check(await sb.from('dokumen').delete().eq('id', d.id));
    await hapusFile(d.file_url);
    toast('Dokumen dihapus');
    await muatDokumen();
  });
});
$('#f-dokumen').addEventListener('submit', e => {
  e.preventDefault();
  busy(e.submitter || $('#f-dokumen button[type=submit]'), async () => {
    const f = $('#d-file').files[0];
    if (f.size > 10 * 1024 * 1024) throw new Error('Ukuran file lebih dari 10 MB');
    const url = await unggah(f, 'dokumen', { image: false });
    check(await sb.from('dokumen').insert({
      judul: $('#d-judul').value.trim(),
      keterangan: $('#d-ket').value.trim(),
      urutan: parseInt($('#d-urutan').value, 10) || 0,
      file_url: url,
    }));
    $('#f-dokumen').reset();
    toast('Dokumen diunggah');
    await muatDokumen();
  });
});


// ================= UNIT USAHA =================
let unitCache = [];
const JENIS_WARNA = { berjalan: '#167a4c', rintisan: '#9a6200', rencana: '#0e5f8a' };
function resetUnit() {
  $('#f-unit').reset();
  $('#u-id').value = '';
  $('#u-preview').innerHTML = '';
  $('#u-hapusfoto-wrap').hidden = true;
  $('#unit-title').textContent = 'Tambah unit usaha';
}
function faktaKeTeks(f) {
  return (Array.isArray(f) ? f : []).map(x => x.label ? `${x.label}: ${x.nilai ?? ''}` : (x.nilai ?? '')).join('\n');
}
function teksKeFakta(t) {
  return t.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const i = l.indexOf(':');
    return i > 0 ? { label: l.slice(0, i).trim(), nilai: l.slice(i + 1).trim() } : { label: '', nilai: l };
  });
}
async function muatUnit() {
  unitCache = check(await sb.from('unit_usaha').select('*').order('urutan').order('dibuat'));
  $('#l-unit').innerHTML = unitCache.length ? unitCache.map(u => {
    const thumb = safeUrl(u.foto_url)
      ? `<img src="${esc(u.foto_url)}" alt="">`
      : `<span class="noimg" style="display:flex;align-items:center;justify-content:center;background:${(IKON[u.ikon] || IKON.umum).bg}">${(IKON[u.ikon] || IKON.umum).svg.replace('<svg ', '<svg width="28" height="28" ')}</span>`;
    return `<div class="item">${thumb}
      <div class="meta"><b>${esc(u.nama)}</b>
        <small><span class="status-dot" style="background:${JENIS_WARNA[u.status_jenis] || '#999'}"></span>${esc(u.status || '—')} · urutan ${u.urutan}</small>
        <span class="badge ${u.tampil ? 'on' : 'off'}">${u.tampil ? 'Tampil' : 'Disembunyikan'}</span></div>
      <div class="acts">
        <button class="btn alt small" data-edit="${u.id}">Edit</button>
        <button class="btn danger small" data-del="${u.id}">Hapus</button>
      </div></div>`;
  }).join('') : '<p class="empty">Belum ada unit usaha. Halaman memakai isi bawaan.</p>';
}
$('#l-unit').addEventListener('click', async e => {
  const id = e.target.dataset.edit || e.target.dataset.del;
  const u = unitCache.find(x => x.id === id);
  if (!u) return;
  if (e.target.dataset.edit) {
    $('#u-id').value = u.id;
    $('#u-nama').value = u.nama;
    $('#u-status').value = u.status || '';
    $('#u-jenis').value = u.status_jenis || 'berjalan';
    $('#u-ikon').value = u.ikon || 'umum';
    $('#u-urutan').value = u.urutan;
    $('#u-ringkasan').value = u.ringkasan || '';
    $('#u-deskripsi').value = u.deskripsi || '';
    $('#u-fakta').value = faktaKeTeks(u.fakta);
    $('#u-wa').value = u.wa_pesan || '';
    $('#u-tampil').checked = u.tampil;
    $('#u-foto').value = '';
    $('#u-hapusfoto').checked = false;
    $('#u-hapusfoto-wrap').hidden = !u.foto_url;
    $('#u-preview').innerHTML = safeUrl(u.foto_url) ? `<img src="${esc(u.foto_url)}" alt="">` : '';
    $('#unit-title').textContent = 'Edit unit usaha';
    $('#f-unit').scrollIntoView({ behavior: 'smooth' });
  } else if (confirm(`Hapus unit "${u.nama}"?`)) {
    await busy(e.target, async () => {
      check(await sb.from('unit_usaha').delete().eq('id', u.id));
      await hapusFile(u.foto_url);
      toast('Unit usaha dihapus');
      await muatUnit();
    });
  }
});
$('#u-reset').addEventListener('click', resetUnit);
previewFile($('#u-foto'), $('#u-preview'));
$('#f-unit').addEventListener('submit', e => {
  e.preventDefault();
  busy(e.submitter || $('#f-unit button[type=submit]'), async () => {
    const id = $('#u-id').value;
    const lama = unitCache.find(x => x.id === id);
    const row = {
      nama: $('#u-nama').value.trim(),
      status: $('#u-status').value.trim(),
      status_jenis: $('#u-jenis').value,
      ikon: $('#u-ikon').value,
      urutan: parseInt($('#u-urutan').value, 10) || 0,
      ringkasan: $('#u-ringkasan').value.trim(),
      deskripsi: $('#u-deskripsi').value.trim(),
      fakta: teksKeFakta($('#u-fakta').value),
      wa_pesan: $('#u-wa').value.trim(),
      tampil: $('#u-tampil').checked,
    };
    const f = $('#u-foto').files[0];
    let fotoLamaDibuang = false;
    if (f) { row.foto_url = await unggah(f, 'unit'); fotoLamaDibuang = true; }
    else if ($('#u-hapusfoto').checked) { row.foto_url = null; fotoLamaDibuang = true; }
    if (id) check(await sb.from('unit_usaha').update(row).eq('id', id));
    else check(await sb.from('unit_usaha').insert(row));
    if (fotoLamaDibuang && lama?.foto_url) await hapusFile(lama.foto_url);
    toast(id ? 'Unit usaha diperbarui' : 'Unit usaha ditambahkan');
    resetUnit();
    await muatUnit();
  });
});

// ================= RINGKASAN KEUANGAN =================
let trans = { catatan: '', kolom: [], baris: [] };
function gambarTabel() {
  const k = trans.kolom;
  $('#tr-tabel').innerHTML = `<thead><tr><th>Uraian</th>${k.map((c, i) => `
      <th><div class="row"><input type="text" data-col="${i}" value="${esc(c)}"><button type="button" class="x" title="Hapus kolom" data-delcol="${i}">×</button></div></th>`).join('')}
      <th></th><th></th></tr></thead>
    <tbody>${trans.baris.map((b, r) => `<tr>
      <td><input type="text" data-r="${r}" data-f="uraian" value="${esc(b.uraian)}"></td>
      ${k.map((_, i) => `<td><input type="text" data-r="${r}" data-v="${i}" value="${esc((b.nilai || [])[i] ?? '')}"></td>`).join('')}
      <td><label class="tb"><input type="checkbox" data-r="${r}" data-f="tebal" ${b.tebal ? 'checked' : ''}> Tebal</label></td>
      <td><button type="button" class="x" title="Hapus baris" data-delrow="${r}">×</button></td>
    </tr>`).join('')}</tbody>`;
}
$('#tr-tabel').addEventListener('input', e => {
  const el = e.target, d = el.dataset;
  if (d.col !== undefined) trans.kolom[+d.col] = el.value;
  else if (d.r !== undefined) {
    const b = trans.baris[+d.r];
    if (d.f === 'uraian') b.uraian = el.value;
    else if (d.f === 'tebal') b.tebal = el.checked;
    else if (d.v !== undefined) { b.nilai = b.nilai || []; b.nilai[+d.v] = el.value; }
  }
});
$('#tr-tabel').addEventListener('change', e => {
  if (e.target.dataset.f === 'tebal') trans.baris[+e.target.dataset.r].tebal = e.target.checked;
});
$('#tr-tabel').addEventListener('click', e => {
  const d = e.target.dataset;
  if (d.delrow !== undefined) { trans.baris.splice(+d.delrow, 1); gambarTabel(); }
  if (d.delcol !== undefined && confirm(`Hapus kolom "${trans.kolom[+d.delcol]}"?`)) {
    trans.kolom.splice(+d.delcol, 1);
    trans.baris.forEach(b => (b.nilai || []).splice(+d.delcol, 1));
    gambarTabel();
  }
});
$('#tr-addrow').addEventListener('click', () => {
  trans.baris.push({ uraian: '', nilai: trans.kolom.map(() => ''), tebal: false });
  gambarTabel();
});
$('#tr-addcol').addEventListener('click', () => {
  const last = trans.kolom[trans.kolom.length - 1] || '';
  const m = last.match(/(\d{4})/);
  trans.kolom.push(m ? last.replace(m[1], String(+m[1] + 1)) : `Tahun ${new Date().getFullYear()}`);
  trans.baris.forEach(b => { b.nilai = b.nilai || []; b.nilai.push(''); });
  gambarTabel();
});
async function muatTrans() {
  const row = check(await sb.from('pengaturan').select('nilai').eq('kunci', 'transparansi').maybeSingle());
  const t = row?.nilai || {};
  trans = {
    catatan: t.catatan || '',
    kolom: Array.isArray(t.kolom) ? t.kolom : ['Tahun 2025', 'Tahun 2026'],
    baris: Array.isArray(t.baris) ? t.baris : [],
  };
  $('#tr-catatan').value = trans.catatan;
  gambarTabel();
}
$('#f-trans').addEventListener('submit', e => {
  e.preventDefault();
  busy(e.submitter || $('#f-trans button[type=submit]'), async () => {
    trans.catatan = $('#tr-catatan').value.trim();
    trans.baris = trans.baris.filter(b => (b.uraian || '').trim() || (b.nilai || []).some(v => String(v || '').trim()));
    trans.baris.forEach(b => { b.nilai = trans.kolom.map((_, i) => (b.nilai || [])[i] ?? ''); });
    check(await sb.from('pengaturan').upsert([{ kunci: 'transparansi', nilai: trans, diperbarui: new Date().toISOString() }]));
    gambarTabel();
    toast('Ringkasan keuangan disimpan');
  });
});

// ================= PENGATURAN =================
async function muatPengaturan() {
  const rows = check(await sb.from('pengaturan').select('kunci,nilai'));
  const cfg = Object.fromEntries(rows.map(r => [r.kunci, r.nilai || {}]));
  const k = cfg.kontak || {}, p = cfg.profil || {};
  $('#s-wa').value = k.wa ? waLocal(k.wa).replace(/-/g, '') : '';
  $('#s-email').value = k.email || '';
  $('#s-alamat').value = k.alamat || '';
  $('#s-jam').value = k.jam || '';
  $('#s-maps').value = k.maps_embed || '';
  $('#s-sejarah').value = p.sejarah || '';
  $('#s-visi').value = p.visi || '';
  $('#s-misi').value = Array.isArray(p.misi) ? p.misi.join('\n') : '';
  $('#s-npwp').value = p.npwp || '';
  $('#s-nib').value = p.nib || '';
}
$('#f-pengaturan').addEventListener('submit', e => {
  e.preventDefault();
  busy(e.submitter || $('#f-pengaturan button[type=submit]'), async () => {
    const now = new Date().toISOString();
    check(await sb.from('pengaturan').upsert([
      { kunci: 'kontak', diperbarui: now, nilai: {
        wa: $('#s-wa').value.trim(), email: $('#s-email').value.trim(),
        alamat: $('#s-alamat').value.trim(), jam: $('#s-jam').value.trim(),
        maps_embed: $('#s-maps').value.trim() } },
      { kunci: 'profil', diperbarui: now, nilai: {
        sejarah: $('#s-sejarah').value.trim(), visi: $('#s-visi').value.trim(),
        misi: $('#s-misi').value.split('\n').map(s => s.trim()).filter(Boolean),
        npwp: $('#s-npwp').value.trim(), nib: $('#s-nib').value.trim() } },
    ]));
    toast('Kontak & profil disimpan');
  });
});

// ================= LOGIN =================
async function masukDasbor(session) {
  $('#who-email').textContent = session.user.email;
  $('#btn-logout').hidden = false;
  const ok = check(await sb.rpc('is_admin'));
  if (!ok) { show('denied'); return; }
  show('app');
  resetBerita();
  await Promise.all([muatBerita(), muatGaleri(), muatUnit(), muatPengurus(), muatDokumen(), muatTrans(), muatPengaturan()])
    .catch(e => toast('Gagal memuat data: ' + e.message, true));
}

$('#f-login').addEventListener('submit', async e => {
  e.preventDefault();
  $('#l-err').textContent = '';
  const btn = $('#f-login button');
  btn.disabled = true;
  const { data, error } = await sb.auth.signInWithPassword({ email: $('#l-email').value.trim(), password: $('#l-pass').value });
  btn.disabled = false;
  if (error) { $('#l-err').textContent = error.message === 'Invalid login credentials' ? 'Email atau password salah.' : error.message; return; }
  await masukDasbor(data.session);
});

$('#btn-logout').addEventListener('click', async () => {
  await sb.auth.signOut();
  location.reload();
});

(async () => {
  if (!isConfigured()) { show('noconfig'); return; }
  try { sb = await getClient(); }
  catch (e) { show('noconfig'); $('#v-noconfig p').textContent = 'Gagal memuat Supabase: ' + e.message; return; }
  const { data } = await sb.auth.getSession();
  if (data.session) await masukDasbor(data.session);
  else show('login');
})();
