# Website BUM Desa Bahtera Nusantara

Website resmi BUM Desa Bahtera Nusantara, Desa Karang Bahagia, Kecamatan Karang Bahagia, Kabupaten Bekasi.

## Struktur
| Path | Isi |
|---|---|
| `index.html`, `profil.html`, `usaha.html`, `kegiatan.html`, `transparansi.html`, `kontak.html`, `berita.html` | Halaman publik |
| `admin/` | Halaman admin (login pengurus) |
| `css/style.css` | Tampilan semua halaman |
| `js/config.js` | **Alamat & kunci Supabase** |
| `js/main.js` | Menu HP, tombol & form WhatsApp, filter galeri |
| `js/data.js`, `js/sb.js` | Mengambil berita, galeri, pengurus, dokumen, kontak dari Supabase |
| `supabase/schema.sql` | Skema database + aturan akses |
| `assets/` | Logo |

Selama Supabase belum diisi di `js/config.js`, website menampilkan isi bawaan di HTML.

## Mengaktifkan mode admin
1. Buat project di [supabase.com](https://supabase.com) (region Singapore).
2. **SQL Editor → New query**, tempel isi `supabase/schema.sql`, klik **Run**.
3. **Authentication → Users → Add user → Create new user**: email `bahteranusantara9@gmail.com` (atau email admin lain), buat password, centang **Auto Confirm User**.
   Email admin lain ditambahkan di SQL Editor: `insert into admin (email) values ('email@contoh.com');`
4. **Authentication → Sign In / Providers**: matikan **Allow new users to sign up** supaya orang luar tidak bisa daftar.
5. **Project Settings → API**: salin *Project URL* dan *anon / publishable key* ke `js/config.js`.
   Jangan pernah memakai *service_role / secret key* di website.
6. Commit → Cloudflare deploy otomatis. Buka `/admin/` dan login.

**Setiap kali `schema.sql` diperbarui** (misalnya fitur baru), jalankan ulang seluruh isinya di SQL Editor. File ini aman dijalankan berulang dan tidak menghapus data yang sudah ada.

## Deploy
Cloudflare (Workers & Pages) terhubung ke branch `main`; setiap push ter-deploy otomatis. Tidak ada build command.

## Lupa password admin
Halaman `/admin/` punya tautan **Lupa password?**. Agar tautan di email mengarah ke website (bukan `localhost`):
1. Supabase → **Authentication → URL Configuration**
2. **Site URL**: alamat website, mis. `https://bahtera-nusantara.bumdes-karangbahagia.workers.dev`
3. **Redirect URLs** → Add URL: `https://bahtera-nusantara.bumdes-karangbahagia.workers.dev/admin/`

Catatan email bawaan Supabase: hanya terkirim ke email anggota tim organisasi Supabase dan dibatasi ±2 email/jam.
Untuk admin lain, undang emailnya di **Organization → Team**, atau pasang SMTP sendiri (Authentication → Emails → SMTP Settings).
Alternatif tanpa email: Supabase → Authentication → Users → pilih user → atur password baru.

## Pratinjau link (WhatsApp/Facebook)
Gambar: `assets/og-image.jpg`. Alamat website untuk pratinjau diatur di setiap halaman (`og:url`, `og:image`); ganti bila domain berubah.
