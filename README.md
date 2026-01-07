# KRM Mobilindo - Sistem Follow-Up Prospek

Repositori ini berisi sistem follow-up prospek untuk KRM Mobilindo yang terdiri dari:

- **Frontend** berbasis Vite + React (folder root).
- **Backend API** berbasis Express (folder `api/`).
- **Skema database** MySQL (folder `database/schema.sql`).

## Fitur Utama

- Login pengguna dan pengelolaan profil.
- Dashboard ringkasan aktivitas.
- Manajemen prospek & penjadwalan follow-up.
- Notifikasi follow-up dan status prospek.
- Laporan serta manajemen user (khusus admin).

## Prasyarat

- Node.js 18+
- MySQL 8+

## Persiapan Environment

### Frontend

1. Salin berkas env:
   ```bash
   cp .env.example .env
   ```
2. Sesuaikan nilai `VITE_API_BASE_URL` agar mengarah ke backend.

### Backend

1. Masuk ke folder backend dan salin env:
   ```bash
   cd api
   cp .env.example .env
   ```
2. Isi konfigurasi database dan SMTP sesuai lingkungan Anda.

### Database

1. Buat database sesuai nama pada `DB_NAME`.
2. Jalankan skema SQL:
   ```bash
   mysql -u root -p krm_mobilindo < database/schema.sql
   ```

## Menjalankan Aplikasi

### Backend API

```bash
cd api
npm install
npm start
```

API akan berjalan di `http://localhost:3001`.

### Frontend

```bash
npm install
npm run dev
```

Frontend akan berjalan di `http://localhost:5173`.

## Catatan

- Berkas unggahan profil disimpan di `api/uploads`.
- Pastikan konfigurasi SMTP valid jika ingin mengaktifkan pengiriman email notifikasi.
