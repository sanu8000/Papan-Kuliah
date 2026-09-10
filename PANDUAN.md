# Panduan Deploy Papan Kuliah (dari Nol)

Ikuti urutan ini persis. Semua akun yang dibuat di sini **gratis**, cukup pakai email.

## Bagian 1 — Buat database (Supabase)

1. Buka https://supabase.com → klik **Start your project** → daftar pakai email/GitHub.
2. Klik **New project**. Isi nama bebas (mis. `papan-kuliah`), buat password database (catat, tidak dipakai lagi setelah ini), pilih region terdekat (Singapore), klik **Create new project**. Tunggu 1-2 menit sampai siap.
3. Di sidebar kiri, klik **SQL Editor** → **New query**.
4. Buka file `schema.sql` yang ada di folder ini, copy semua isinya, paste ke editor, lalu klik **Run**. Ini membuat tabel `categories` dan `tasks` beserta aturan keamanannya.
5. Di sidebar kiri, klik **Authentication** → **Providers**, pastikan **Email** aktif.
6. Masih di **Authentication**, klik **Settings** (atau **Sign In / Providers** tergantung tampilan), cari opsi **Confirm email** lalu **matikan (off)**. Ini penting — tanpa ini, akun baru tidak bisa langsung login karena sistem menunggu konfirmasi ke email yang sebenarnya tidak nyata.
7. Klik **Project Settings** (ikon gerigi) → **API**. Catat dua nilai ini, akan dipakai nanti:
   - **Project URL**
   - **anon public key**

## Bagian 2 — Unggah kode (GitHub)

1. Buka https://github.com → **Sign up** → daftar pakai email.
2. Setelah masuk, klik tombol **+** di kanan atas → **New repository**. Nama bebas (mis. `papan-kuliah`), pilih **Public**, klik **Create repository**.
3. Di halaman repo kosong itu, klik link **uploading an existing file**.
4. Buka folder proyek ini di komputer kamu, **seleksi semua file dan folder di dalamnya** (kecuali `node_modules` — memang tidak ada), lalu **drag & drop** ke halaman GitHub tadi.
5. Tunggu upload selesai, scroll ke bawah, klik **Commit changes**.

## Bagian 3 — Deploy (Vercel)

1. Buka https://vercel.com → **Sign Up** → pilih **Continue with GitHub** (pakai akun GitHub dari Bagian 2).
2. Setelah masuk dashboard, klik **Add New** → **Project**.
3. Cari repo `papan-kuliah` yang tadi dibuat, klik **Import**.
4. Sebelum klik Deploy, buka bagian **Environment Variables**, tambahkan dua baris:
   - `NEXT_PUBLIC_SUPABASE_URL` → isi dengan Project URL dari Bagian 1 langkah 7
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → isi dengan anon public key dari Bagian 1 langkah 7
5. Klik **Deploy**. Tunggu 1-2 menit.
6. Setelah selesai, Vercel akan kasih link seperti `papan-kuliah-xxxx.vercel.app` — itu link web kamu yang sudah bisa dibuka siapa saja.

## Bagian 4 — Coba

Buka link Vercel tadi, klik tab **Daftar**, isi nama, username, password → langsung masuk ke papan tugas. Bagikan link yang sama ke teman supaya mereka bisa daftar akun sendiri.

## Kalau mau ubah kode nanti

Edit file di GitHub langsung (klik file → ikon pensil → edit → Commit), atau upload ulang file yang diubah. Vercel otomatis deploy ulang setiap ada perubahan di repo GitHub — tidak perlu klik apa-apa lagi di Vercel.

## Kalau mau domain sendiri nanti

Beli domain (Niagahoster, Namecheap, dll), lalu di dashboard Vercel: **Project → Settings → Domains → Add**, ikuti instruksi untuk mengarahkan domain ke Vercel.
