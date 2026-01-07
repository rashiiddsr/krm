import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { FollowUp, Prospect, Profile } from '../lib/database.types';
import { Calendar, CheckCircle, Clock, Search, User, Phone, FileText, X } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedFollowUp, setSelectedFollowUp] = useState<FollowUpWithDetails | null>(null);
  const [updateData, setUpdateData] = useState({
    status: '',
    notes: '',
    scheduled_date: '',
  });

  useEffect(() => {
    loadFollowUps();
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

    setFilteredFollowUps(filtered);
  }, [searchTerm, filterStatus, followUps]);

  const loadFollowUps = async () => {
    if (!profile) return;

    try {
      let query = supabase
        .from('follow_ups')
        .select(`
          *,
          prospect:prospects(*),
          assignedToProfile:profiles!follow_ups_assigned_to_fkey(*),
          assignedByProfile:profiles!follow_ups_assigned_by_fkey(*)
        `)
        .order('scheduled_date', { ascending: true });

      if (profile.role === 'sales') {
        query = query.eq('assigned_to', profile.id);
      }

      const { data, error } = await query;

      if (error) throw error;
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

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFollowUp || !profile) return;

    try {
      const updates: any = {
        status: updateData.status,
        notes: updateData.notes,
      };

      if (updateData.status === 'completed') {
        updates.completed_at = new Date().toISOString();

        await supabase
          .from('prospects')
          .update({ status: 'selesai' })
          .eq('id', selectedFollowUp.prospect_id);
      }

      if (updateData.status === 'rescheduled') {
        updates.scheduled_date = updateData.scheduled_date;
        updates.status = 'pending';
      }

      const { error: updateError } = await supabase
        .from('follow_ups')
        .update(updates)
        .eq('id', selectedFollowUp.id);

      if (updateError) throw updateError;

      await supabase.from('notifications').insert({
        user_id: selectedFollowUp.assigned_by,
        type: 'follow_up_updated',
        title: 'Follow-Up Diupdate',
        message: `${profile.full_name} telah mengupdate follow-up untuk prospek: ${selectedFollowUp.prospect?.nama}`,
        reference_id: selectedFollowUp.id,
        reference_type: 'follow_up',
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

  const isOverdue = (scheduledDate: string) => {
    return new Date(scheduledDate) < new Date() && selectedFollowUp?.status !== 'completed';
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

      <div className="grid grid-cols-1 gap-4">
        {filteredFollowUps.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">Belum ada follow-up</p>
          </div>
        ) : (
          filteredFollowUps.map((followUp) => {
            const overdue = isOverdue(followUp.scheduled_date);
            return (
              <div
                key={followUp.id}
                className={`bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow ${
                  overdue ? 'border-red-300 bg-red-50/30' : 'border-gray-200'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {followUp.prospect?.nama}
                        </h3>
                        {profile?.role === 'admin' && (
                          <p className="text-sm text-gray-500 mt-1">
                            Sales: {followUp.assignedToProfile?.full_name}
                          </p>
                        )}
                      </div>
                      {getStatusBadge(followUp.status)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm">{followUp.prospect?.no_hp}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-4 h-4 flex-shrink-0" />
                        <span className={`text-sm ${overdue ? 'text-red-600 font-medium' : ''}`}>
                          {new Date(followUp.scheduled_date).toLocaleString('id-ID')}
                          {overdue && ' (Terlambat)'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-gray-600">
                      <User className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Kebutuhan: {followUp.prospect?.kebutuhan}</span>
                    </div>

                    {followUp.notes && (
                      <div className="flex items-start gap-2 text-gray-600">
                        <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">Catatan: {followUp.notes}</span>
                      </div>
                    )}

                    {followUp.completed_at && (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm">
                          Diselesaikan: {new Date(followUp.completed_at).toLocaleString('id-ID')}
                        </span>
                      </div>
                    )}
                  </div>

                  {profile?.role === 'sales' && followUp.status !== 'completed' && (
                    <button
                      onClick={() => openUpdateModal(followUp)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Clock className="w-4 h-4" />
                      Update Status
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
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

              <div>
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
    </div>
  );
}
