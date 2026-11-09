-- =====================================================================
-- Skema database website BUMDes Bahtera Nusantara
-- Cara pakai: Supabase Dashboard -> SQL Editor -> New query -> tempel semua -> Run
-- Aman dijalankan ulang (idempotent).
-- =====================================================================

-- ---------- Daftar email admin ----------
create table if not exists public.admin (
  email text primary key
);
alter table public.admin enable row level security;
-- Tidak ada policy: tabel admin tidak bisa dibaca/diubah lewat website, hanya dari dashboard Supabase.

-- Fungsi pengecek: apakah user yang login termasuk admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- Pengaturan situs (kontak, profil) ----------
create table if not exists public.pengaturan (
  kunci text primary key,          -- 'kontak' atau 'profil'
  nilai jsonb not null default '{}'::jsonb,
  diperbarui timestamptz not null default now()
);

-- ---------- Pengurus ----------
create table if not exists public.pengurus (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  jabatan text not null,
  foto_url text,
  urutan int not null default 0,
  dibuat timestamptz not null default now()
);

-- ---------- Berita ----------
create table if not exists public.berita (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  isi text not null default '',
  tanggal date not null default current_date,
  foto_url text,
  terbit boolean not null default false,
  dibuat timestamptz not null default now()
);

-- ---------- Galeri ----------
create table if not exists public.galeri (
  id uuid primary key default gen_random_uuid(),
  foto_url text not null,
  keterangan text not null default '',
  kategori text not null default 'umum' check (kategori in ('padi','ayam','ikan','umum')),
  dibuat timestamptz not null default now()
);

-- ---------- Dokumen transparansi ----------
create table if not exists public.dokumen (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  keterangan text not null default '',
  file_url text not null,
  urutan int not null default 0,
  dibuat timestamptz not null default now()
);

-- ---------- Hak akses Data API ----------
-- Diperlukan bila opsi "Automatically expose new tables" dimatikan saat membuat project.
-- Siapa boleh melihat/mengubah baris tetap diatur oleh RLS di bawah.
grant usage on schema public to anon, authenticated;
grant select on public.pengaturan, public.pengurus, public.berita, public.galeri, public.dokumen to anon, authenticated;
grant insert, update, delete on public.pengaturan, public.pengurus, public.berita, public.galeri, public.dokumen to authenticated;

-- ---------- Row Level Security ----------
alter table public.pengaturan enable row level security;
alter table public.pengurus   enable row level security;
alter table public.berita     enable row level security;
alter table public.galeri     enable row level security;
alter table public.dokumen    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['pengaturan','pengurus','galeri','dokumen'] loop
    execute format('drop policy if exists "baca publik" on public.%I', t);
    execute format('create policy "baca publik" on public.%I for select using (true)', t);
  end loop;
  foreach t in array array['pengaturan','pengurus','berita','galeri','dokumen'] loop
    execute format('drop policy if exists "admin kelola" on public.%I', t);
    execute format('create policy "admin kelola" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Berita: tamu hanya melihat yang sudah terbit, admin melihat semua (termasuk draf)
drop policy if exists "baca publik" on public.berita;
create policy "baca publik" on public.berita for select using (terbit = true or public.is_admin());

-- ---------- Storage untuk foto & PDF ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 10485760)   -- maks 10 MB per file
on conflict (id) do update set public = true, file_size_limit = 10485760;

drop policy if exists "media admin tambah" on storage.objects;
drop policy if exists "media admin ubah"   on storage.objects;
drop policy if exists "media admin hapus"  on storage.objects;
create policy "media admin tambah" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin());
create policy "media admin ubah" on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_admin());
create policy "media admin hapus" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());

-- ---------- Data awal ----------
insert into public.pengaturan (kunci, nilai) values
  ('kontak', jsonb_build_object(
      'wa', '089660279551',
      'email', 'bahteranusantara9@gmail.com',
      'alamat', '',
      'jam', '',
      'maps_embed', '')),
  ('profil', jsonb_build_object(
      'sejarah', 'BUMDes Bahtera Nusantara didirikan oleh Pemerintah Desa Karang Bahagia melalui Peraturan Desa Nomor 2 Tahun 2025.',
      'visi', '',
      'misi', jsonb_build_array(
        'Mengembangkan usaha berbasis potensi lokal: pertanian, peternakan, dan perikanan.',
        'Membuka lapangan kerja dan memberdayakan warga desa.',
        'Menyumbang Pendapatan Asli Desa secara transparan dan akuntabel.'),
      'npwp', '',
      'nib', ''))
on conflict (kunci) do nothing;

insert into public.pengurus (nama, jabatan, urutan)
select * from (values ('Caum','Penasihat (Kepala Desa)',1), ('Johandi','Direktur',2)) v(nama, jabatan, urutan)
where not exists (select 1 from public.pengurus);

-- ---------- Admin ----------
-- Ganti / tambah email admin di sini. Akun dengan email ini harus juga dibuat di
-- Authentication -> Users -> Add user (centang Auto Confirm User).
insert into public.admin (email) values ('bahteranusantara9@gmail.com')
on conflict do nothing;
