import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import type { Prospect, Profile } from '../lib/database.types';
import { Plus, Search, Edit, Calendar, User, Phone, MapPin, FileText, X } from 'lucide-react';

interface ProspectWithSales extends Prospect {
  sales?: Profile;
}

export default function Prospects() {
  const { profile } = useAuth();
  const [prospects, setProspects] = useState<ProspectWithSales[]>([]);
  const [filteredProspects, setFilteredProspects] = useState<ProspectWithSales[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<ProspectWithSales | null>(null);
  const [salesList, setSalesList] = useState<Profile[]>([]);
  const [formData, setFormData] = useState({
    nama: '',
    no_hp: '',
    alamat: '',
    kebutuhan: '',
  });
  const [followUpData, setFollowUpData] = useState({
    assigned_to: '',
    scheduled_date: '',
    notes: '',
  });

  useEffect(() => {
    loadProspects();
    if (profile?.role === 'admin') {
      loadSalesList();
    }
  }, [profile]);

  useEffect(() => {
    const filtered = prospects.filter(
      (p) =>
        p.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.no_hp.includes(searchTerm) ||
        p.kebutuhan.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredProspects(filtered);
  }, [searchTerm, prospects]);

  const loadProspects = async () => {
    if (!profile) return;

    try {
      const data = await api.listProspectsWithSales({
        salesId: profile.role === 'sales' ? profile.id : undefined,
      });
      setProspects(data || []);
      setFilteredProspects(data || []);
    } catch (error) {
      console.error('Error loading prospects:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSalesList = async () => {
    const data = await api.listProfiles('sales');
    if (data) setSalesList(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      if (selectedProspect) {
        await api.updateProspect(selectedProspect.id, formData);
      } else {
        const newProspect = await api.createProspect({
          ...formData,
          sales_id: profile.id,
          status: 'menunggu_follow_up',
        });

        const adminProfiles = await api.listProfiles('admin');

        if (adminProfiles && newProspect) {
          const notifications = adminProfiles.map((admin) => ({
            user_id: admin.id,
            type: 'new_prospect' as const,
            title: 'Prospek Baru',
            message: `${profile.full_name} menambahkan prospek baru: ${formData.nama}`,
            reference_id: newProspect.id,
            reference_type: 'prospect' as const,
            is_read: false,
          }));

          await api.createNotifications(notifications);
        }
      }

      setShowModal(false);
      resetForm();
      loadProspects();
    } catch (error) {
      console.error('Error saving prospect:', error);
      alert('Gagal menyimpan data prospek');
    }
  };

  const handleCreateFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedProspect) return;

    try {
      const followUp = await api.createFollowUp({
        prospect_id: selectedProspect.id,
        assigned_by: profile.id,
        assigned_to: followUpData.assigned_to,
        scheduled_date: followUpData.scheduled_date,
        notes: followUpData.notes,
        status: 'pending',
      });

      await api.updateProspect(selectedProspect.id, { status: 'dalam_follow_up' });

      await api.createNotifications({
        user_id: followUpData.assigned_to,
        type: 'follow_up_assigned',
        title: 'Follow-Up Baru',
        message: `Anda ditugaskan untuk follow-up prospek: ${selectedProspect.nama}`,
        reference_id: followUp.id,
        reference_type: 'follow_up',
        is_read: false,
      });

      setShowFollowUpModal(false);
      resetFollowUpForm();
      loadProspects();
    } catch (error) {
      console.error('Error creating follow-up:', error);
      alert('Gagal membuat follow-up');
    }
  };

  const resetForm = () => {
    setFormData({
      nama: '',
      no_hp: '',
      alamat: '',
      kebutuhan: '',
    });
    setSelectedProspect(null);
  };

  const resetFollowUpForm = () => {
    setFollowUpData({
      assigned_to: '',
      scheduled_date: '',
      notes: '',
    });
    setSelectedProspect(null);
  };

  const openEditModal = (prospect: ProspectWithSales) => {
    setSelectedProspect(prospect);
    setFormData({
      nama: prospect.nama,
      no_hp: prospect.no_hp,
      alamat: prospect.alamat,
      kebutuhan: prospect.kebutuhan,
    });
    setShowModal(true);
  };

  const openFollowUpModal = (prospect: ProspectWithSales) => {
    setSelectedProspect(prospect);
    setFollowUpData({
      assigned_to: prospect.sales_id,
      scheduled_date: '',
      notes: '',
    });
    setShowFollowUpModal(true);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      menunggu_follow_up: { label: 'Menunggu Follow-Up', color: 'bg-yellow-100 text-yellow-700' },
      dalam_follow_up: { label: 'Dalam Follow-Up', color: 'bg-blue-100 text-blue-700' },
      selesai: { label: 'Selesai', color: 'bg-green-100 text-green-700' },
    };
    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daftar Prospek</h1>
          <p className="text-gray-600 mt-1">Kelola data prospek pelanggan</p>
        </div>
        {profile?.role === 'sales' && (
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Tambah Prospek
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Cari prospek..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredProspects.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <User className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">Belum ada prospek</p>
          </div>
        ) : (
          filteredProspects.map((prospect) => (
            <div
              key={prospect.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{prospect.nama}</h3>
                      {profile?.role === 'admin' && prospect.sales && (
                        <p className="text-sm text-gray-500 mt-1">Sales: {prospect.sales.full_name}</p>
                      )}
                    </div>
                    {getStatusBadge(prospect.status)}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm">{prospect.no_hp}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm">{prospect.alamat}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-gray-600">
                    <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{prospect.kebutuhan}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {profile?.role === 'sales' && prospect.sales_id === profile.id && (
                    <button
                      onClick={() => openEditModal(prospect)}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                  )}
                  {profile?.role === 'admin' && prospect.status === 'menunggu_follow_up' && (
                    <button
                      onClick={() => openFollowUpModal(prospect)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Calendar className="w-4 h-4" />
                      Buat Follow-Up
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedProspect ? 'Edit Prospek' : 'Tambah Prospek Baru'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nama</label>
                <input
                  type="text"
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">No HP</label>
                <input
                  type="text"
                  value={formData.no_hp}
                  onChange={(e) => setFormData({ ...formData, no_hp: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Alamat</label>
                <textarea
                  value={formData.alamat}
                  onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  rows={3}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Kebutuhan</label>
                <textarea
                  value={formData.kebutuhan}
                  onChange={(e) => setFormData({ ...formData, kebutuhan: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  rows={3}
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {selectedProspect ? 'Update' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showFollowUpModal && selectedProspect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Buat Follow-Up</h2>
              <button
                onClick={() => {
                  setShowFollowUpModal(false);
                  resetFollowUpForm();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFollowUp} className="p-6 space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-700">Prospek: {selectedProspect.nama}</p>
                <p className="text-sm text-gray-600 mt-1">{selectedProspect.kebutuhan}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assign ke Sales</label>
                <select
                  value={followUpData.assigned_to}
                  onChange={(e) => setFollowUpData({ ...followUpData, assigned_to: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                >
                  <option value="">Pilih Sales</option>
                  {salesList.map((sales) => (
                    <option key={sales.id} value={sales.id}>
                      {sales.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal Follow-Up</label>
                <input
                  type="datetime-local"
                  value={followUpData.scheduled_date}
                  onChange={(e) => setFollowUpData({ ...followUpData, scheduled_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Catatan (Opsional)</label>
                <textarea
                  value={followUpData.notes}
                  onChange={(e) => setFollowUpData({ ...followUpData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowFollowUpModal(false);
                    resetFollowUpForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Buat Follow-Up
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
