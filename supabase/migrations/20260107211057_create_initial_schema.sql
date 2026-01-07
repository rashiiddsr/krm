/*
  # KRM MOBILINDO - Sistem Notifikasi Follow-up Prospek

  ## Overview
  Database schema untuk sistem manajemen prospek dan follow-up showroom mobil KRM MOBILINDO
  
  ## New Tables
  
  ### 1. `profiles`
  Menyimpan data profil user (admin dan sales)
  - `id` (uuid, FK to auth.users) - Primary key, reference ke auth.users
  - `email` (text) - Email user
  - `full_name` (text) - Nama lengkap
  - `role` (text) - Role: 'admin' atau 'sales'
  - `created_at` (timestamptz) - Timestamp pembuatan
  - `updated_at` (timestamptz) - Timestamp update terakhir
  
  ### 2. `prospects`
  Menyimpan data prospek pelanggan
  - `id` (uuid) - Primary key
  - `nama` (text) - Nama prospek
  - `no_hp` (text) - Nomor HP prospek
  - `alamat` (text) - Alamat prospek
  - `kebutuhan` (text) - Kebutuhan/keinginan prospek
  - `status` (text) - Status: 'menunggu_follow_up', 'dalam_follow_up', 'selesai'
  - `sales_id` (uuid, FK) - ID sales yang input prospek
  - `created_at` (timestamptz) - Timestamp pembuatan
  - `updated_at` (timestamptz) - Timestamp update terakhir
  
  ### 3. `follow_ups`
  Menyimpan data follow-up prospek
  - `id` (uuid) - Primary key
  - `prospect_id` (uuid, FK) - ID prospek
  - `assigned_by` (uuid, FK) - ID admin yang assign
  - `assigned_to` (uuid, FK) - ID sales yang ditugaskan
  - `scheduled_date` (timestamptz) - Tanggal jadwal follow-up
  - `status` (text) - Status: 'pending', 'in_progress', 'completed', 'rescheduled'
  - `notes` (text) - Catatan follow-up (opsional)
  - `completed_at` (timestamptz) - Timestamp selesai
  - `created_at` (timestamptz) - Timestamp pembuatan
  - `updated_at` (timestamptz) - Timestamp update terakhir
  
  ### 4. `notifications`
  Menyimpan notifikasi untuk admin dan sales
  - `id` (uuid) - Primary key
  - `user_id` (uuid, FK) - ID user penerima notifikasi
  - `type` (text) - Tipe notifikasi: 'new_prospect', 'follow_up_assigned', 'follow_up_updated'
  - `title` (text) - Judul notifikasi
  - `message` (text) - Isi notifikasi
  - `reference_id` (uuid) - ID referensi (prospect_id atau follow_up_id)
  - `reference_type` (text) - Tipe referensi: 'prospect' atau 'follow_up'
  - `is_read` (boolean) - Status sudah dibaca atau belum
  - `created_at` (timestamptz) - Timestamp pembuatan
  
  ## Security
  - Enable RLS on all tables
  - Policies untuk akses berdasarkan role (admin/sales)
  - Admin dapat akses semua data
  - Sales hanya dapat akses data mereka sendiri
  
  ## Important Notes
  1. Default admin user akan dibuat dengan username: admin, password: admin
  2. Semua timestamp menggunakan timezone
  3. Foreign keys dengan cascade delete untuk data integrity
  4. Index pada kolom yang sering di-query untuk performa optimal
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'sales')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create prospects table
CREATE TABLE IF NOT EXISTS prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL,
  no_hp text NOT NULL,
  alamat text NOT NULL,
  kebutuhan text NOT NULL,
  status text NOT NULL DEFAULT 'menunggu_follow_up' CHECK (status IN ('menunggu_follow_up', 'dalam_follow_up', 'selesai')),
  sales_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create follow_ups table
CREATE TABLE IF NOT EXISTS follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scheduled_date timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rescheduled')),
  notes text DEFAULT '',
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('new_prospect', 'follow_up_assigned', 'follow_up_updated')),
  title text NOT NULL,
  message text NOT NULL,
  reference_id uuid NOT NULL,
  reference_type text NOT NULL CHECK (reference_type IN ('prospect', 'follow_up')),
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_prospects_sales_id ON prospects(sales_id);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_follow_ups_prospect_id ON follow_ups(prospect_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_assigned_to ON follow_ups(assigned_to);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Prospects policies
CREATE POLICY "Sales can view own prospects"
  ON prospects FOR SELECT
  TO authenticated
  USING (
    sales_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Sales can insert prospects"
  ON prospects FOR INSERT
  TO authenticated
  WITH CHECK (sales_id = auth.uid());

CREATE POLICY "Sales can update own prospects"
  ON prospects FOR UPDATE
  TO authenticated
  USING (
    sales_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update prospects"
  ON prospects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Follow-ups policies
CREATE POLICY "Users can view related follow-ups"
  ON follow_ups FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid() OR
    assigned_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert follow-ups"
  ON follow_ups FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can update assigned follow-ups"
  ON follow_ups FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete follow-ups"
  ON follow_ups FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Notifications policies
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prospects_updated_at
  BEFORE UPDATE ON prospects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_follow_ups_updated_at
  BEFORE UPDATE ON follow_ups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();