import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import type { FollowUp, Prospect, Profile } from '../lib/database.types';
import { Calendar, CheckCircle, Clock, Search, X, Eye } from 'lucide-react';

interface FollowUpWithDetails extends FollowUp {
  prospect?: Prospect;
  assignedToProfile?: Profile;
  assignedByProfile?: Profile;
}

export default function FollowUps() {
  const { profile } = useAuth();
  const [followUps, setFollowUps] = useState<FollowUpWithDetails[]>([]);
  const [filteredFollowUps, setFilteredFollowUps] = useState<FollowUpWithDetails[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedFollowUp, setSelectedFollowUp] = useState<FollowUpWithDetails | null>(null);
  const [detailFollowUp, setDetailFollowUp] = useState<FollowUpWithDetails | null>(null);
  const [updateData, setUpdateData] = useState({
    status: '',
    notes: '',
    scheduled_date: '',
  });

  useEffect(() => {
    if (!profile) return;

    loadFollowUps();
    const interval = setInterval(loadFollowUps, 10000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadFollowUps();
      }
    };

    const handleFocus = () => {
      loadFollowUps();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [profile]);

  useEffect(() => {
    let filtered = followUps;

    if (searchTerm) {
      filtered = filtered.filter(
        (f) =>
          f.prospect?.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
          f.prospect?.no_hp.includes(searchTerm)
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((f) => f.status === filterStatus);
    }

    if (filterStartDate || filterEndDate) {
      filtered = filtered.filter((f) => isWithinDateRange(f.scheduled_date));
    }

    setFilteredFollowUps(filtered);
  }, [searchTerm, filterStatus, filterStartDate, filterEndDate, followUps]);

  const loadFollowUps = async () => {
    if (!profile) return;

    try {
      const data = await api.listFollowUps({
        assignedTo: profile.role === 'sales' ? profile.id : undefined,
      });

      setFollowUps(data || []);
      setFilteredFollowUps(data || []);
    } catch (error) {
      console.error('Error loading follow-ups:', error);
    } finally {
      setLoading(false);
    }
  };

  const openUpdateModal = (followUp: FollowUpWithDetails) => {
    setSelectedFollowUp(followUp);
    setUpdateData({
      status: followUp.status,
      notes: followUp.notes,
      scheduled_date: followUp.scheduled_date,
    });
    setShowUpdateModal(true);
  };

  const openDetailModal = (followUp: FollowUpWithDetails) => {
    setDetailFollowUp(followUp);
    setShowDetailModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFollowUp || !profile) return;

    try {
      const updates: Partial<FollowUp> = {
        status: updateData.status as FollowUp['status'],
        notes: updateData.notes,
      };

      if (updateData.status === 'completed') {
        updates.completed_at = new Date().toISOString();

        await api.updateProspect(selectedFollowUp.prospect_id, { status: 'selesai' });
      }

      if (updateData.status === 'rescheduled') {
        updates.scheduled_date = updateData.scheduled_date;
        updates.status = 'pending';
      }

      await api.updateFollowUp(selectedFollowUp.id, updates);

      await api.createNotifications({
        user_id: selectedFollowUp.assigned_by,
        type: 'follow_up_updated',
        title: 'Follow-Up Diupdate',
        message: `${profile.full_name} telah mengupdate follow-up untuk prospek: ${selectedFollowUp.prospect?.nama}`,
        reference_id: selectedFollowUp.id,
        reference_type: 'follow_up',
        is_read: false,
      });

      setShowUpdateModal(false);
      setSelectedFollowUp(null);
      loadFollowUps();
    } catch (error) {
      console.error('Error updating follow-up:', error);
      alert('Gagal mengupdate follow-up');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
      in_progress: { label: 'Dalam Progress', color: 'bg-blue-100 text-blue-700' },
      completed: { label: 'Selesai', color: 'bg-green-100 text-green-700' },
      rescheduled: { label: 'Dijadwalkan Ulang', color: 'bg-purple-100 text-purple-700' },
    };
    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const isOverdue = (scheduledDate: string, status: string) => {
    return new Date(scheduledDate) < new Date() && status !== 'completed';
  };

  const isWithinDateRange = (dateValue: string) => {
    if (!filterStartDate && !filterEndDate) return true;
    const date = new Date(dateValue);
    if (filterStartDate) {
      const start = new Date(`${filterStartDate}T00:00:00`);
      if (date < start) return false;
    }
    if (filterEndDate) {
      const end = new Date(`${filterEndDate}T23:59:59`);
      if (date > end) return false;
    }
    return true;
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Daftar Follow-Up</h1>
        <p className="text-gray-600 mt-1">Kelola follow-up prospek</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-4">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="date"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          <input
            type="date"
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Semua
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === 'pending'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilterStatus('in_progress')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === 'in_progress'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Dalam Progress
          </button>
          <button
            onClick={() => setFilterStatus('completed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === 'completed'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Selesai
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Prospek
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  No HP
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Jadwal
                </th>
                {profile?.role === 'admin' && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Sales
                  </th>
                )}
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredFollowUps.length === 0 ? (
                <tr>
                  <td
                    colSpan={profile?.role === 'admin' ? 6 : 5}
                    className="px-6 py-10 text-center"
                  >
                    <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600">Belum ada follow-up</p>
                  </td>
                </tr>
              ) : (
                filteredFollowUps.map((followUp) => {
                  const overdue = isOverdue(followUp.scheduled_date, followUp.status);
                  return (
                    <tr
                      key={followUp.id}
                      className={`hover:bg-gray-50 ${overdue ? 'bg-red-50/40' : ''}`}
                    >
                      <td className="px-4 py-4 text-sm font-semibold text-gray-900">
                        {followUp.prospect?.nama}
                      </td>
                      <td className="px-4 py-4 text-sm">{getStatusBadge(followUp.status)}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {followUp.prospect?.no_hp}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        <span className={overdue ? 'text-red-600 font-medium' : ''}>
                          {new Date(followUp.scheduled_date).toLocaleString('id-ID')}
                          {overdue && ' (Terlambat)'}
                        </span>
                      </td>
                      {profile?.role === 'admin' && (
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {followUp.assignedToProfile?.full_name || '-'}
                        </td>
                      )}
                      <td className="px-4 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => openDetailModal(followUp)}
                            className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            Detail
                          </button>
                          {profile?.role === 'sales' && followUp.status !== 'completed' && (
                            <button
                              onClick={() => openUpdateModal(followUp)}
                              className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              <Clock className="w-4 h-4" />
                              Update Status
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showUpdateModal && selectedFollowUp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Update Follow-Up</h2>
              <button
                onClick={() => {
                  setShowUpdateModal(false);
                  setSelectedFollowUp(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-700">
                  Prospek: {selectedFollowUp.prospect?.nama}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Jadwal: {new Date(selectedFollowUp.scheduled_date).toLocaleString('id-ID')}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={updateData.status}
                    onChange={(e) => setUpdateData({ ...updateData, status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    required
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">Dalam Progress</option>
                    <option value="completed">Selesai</option>
                    <option value="rescheduled">Jadwalkan Ulang</option>
                  </select>
                </div>

                {updateData.status === 'rescheduled' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Jadwal Baru
                    </label>
                    <input
                      type="datetime-local"
                      value={updateData.scheduled_date}
                      onChange={(e) =>
                        setUpdateData({ ...updateData, scheduled_date: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      required
                    />
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Catatan (Opsional)
                  </label>
                  <textarea
                    value={updateData.notes}
                    onChange={(e) => setUpdateData({ ...updateData, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    rows={4}
                    placeholder="Tambahkan catatan tentang follow-up ini..."
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowUpdateModal(false);
                    setSelectedFollowUp(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailModal && detailFollowUp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Detail Follow-Up</h2>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setDetailFollowUp(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500">Prospek</p>
                <p className="text-base font-semibold text-gray-900">
                  {detailFollowUp.prospect?.nama}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <div className="mt-1">{getStatusBadge(detailFollowUp.status)}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">No HP</p>
                  <p className="text-sm text-gray-900">{detailFollowUp.prospect?.no_hp}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Jadwal</p>
                  <p className="text-sm text-gray-900">
                    {new Date(detailFollowUp.scheduled_date).toLocaleString('id-ID')}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Kebutuhan</p>
                <p className="text-sm text-gray-900">{detailFollowUp.prospect?.kebutuhan}</p>
              </div>
              {detailFollowUp.notes && (
                <div>
                  <p className="text-sm text-gray-500">Catatan</p>
                  <p className="text-sm text-gray-900">{detailFollowUp.notes}</p>
                </div>
              )}
              {detailFollowUp.completed_at && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">
                    Diselesaikan: {new Date(detailFollowUp.completed_at).toLocaleString('id-ID')}
                  </span>
                </div>
              )}
              {profile?.role === 'admin' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Sales</p>
                    <p className="text-sm text-gray-900">
                      {detailFollowUp.assignedToProfile?.full_name || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Ditugaskan Oleh</p>
                    <p className="text-sm text-gray-900">
                      {detailFollowUp.assignedByProfile?.full_name || '-'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
