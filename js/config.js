// ====== KONFIGURASI SUPABASE ======
// Isi dari Supabase Dashboard -> Project Settings -> API (atau Data API).
// "anon / publishable key" AMAN dipasang di sini karena akses dibatasi aturan RLS.
// JANGAN pernah menaruh "service_role / secret key" di sini.
window.BUMDES_CONFIG = {
  supabaseUrl: "",      // contoh: "https://abcdefgh.supabase.co"
  supabaseAnonKey: ""   // contoh: "eyJhbGciOi..." atau "sb_publishable_..."
};
