import { useEffect, useState } from 'react';
import { Camera, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

export default function Profile() {
  const { profile, updateProfileState } = useAuth();
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    username: '',
    no_hp: '',
    password: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!profile) return;
    setFormData({
      full_name: profile.full_name,
      email: profile.email,
      username: profile.username,
      no_hp: profile.no_hp,
      password: '',
    });
  }, [profile]);

  if (!profile) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const updated = await api.updateProfile(profile.id, {
        full_name: formData.full_name,
        email: formData.email,
        username: formData.username,
        no_hp: formData.no_hp,
        ...(formData.password ? { password: formData.password } : {}),
      });
      updateProfileState(updated);
      setFormData((prev) => ({ ...prev, password: '' }));
      setMessage('Perubahan profil berhasil disimpan.');
    } catch (error: any) {
      setMessage(error.message || 'Gagal menyimpan profil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex items-center gap-6">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-xl font-semibold text-gray-700">
            {profile.full_name.slice(0, 2).toUpperCase()}
          </div>
          <button
            type="button"
            className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-2 shadow-md"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>
        <div>
          <p className="text-sm text-gray-500">Profil</p>
          <h2 className="text-xl font-semibold text-gray-900">{profile.full_name}</h2>
          <p className="text-sm text-gray-500 capitalize">{profile.role}</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nama Lengkap</label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(event) => setFormData({ ...formData, full_name: event.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(event) => setFormData({ ...formData, email: event.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
            <input
              type="text"
              value={formData.username}
              onChange={(event) => setFormData({ ...formData, username: event.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">No HP</label>
            <input
              type="tel"
              value={formData.no_hp}
              onChange={(event) => setFormData({ ...formData, no_hp: event.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Password Baru</label>
            <input
              type="password"
              value={formData.password}
              onChange={(event) => setFormData({ ...formData, password: event.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="Kosongkan jika tidak ingin mengganti"
            />
            <p className="text-xs text-gray-500 mt-1">Kosongkan jika tidak ingin mengganti</p>
          </div>
        </div>

        {message && (
          <div className="text-sm text-blue-600 bg-blue-50 border border-blue-100 px-4 py-2 rounded-lg">
            {message}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </div>
  );
}
