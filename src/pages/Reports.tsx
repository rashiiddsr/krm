import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Prospect, FollowUp, Profile } from '../lib/database.types';
import { Download, Filter, Calendar, Users, CheckCircle } from 'lucide-react';

interface ReportData {
  totalProspects: number;
  totalFollowUps: number;
  completedFollowUps: number;
  pendingFollowUps: number;
  prospectsByStatus: { status: string; count: number }[];
  salesPerformance: { sales: Profile; prospectsCount: number; completedFollowUps: number }[];
}

export default function Reports() {
  const [reportData, setReportData] = useState<ReportData>({
    totalProspects: 0,
    totalFollowUps: 0,
    completedFollowUps: 0,
    pendingFollowUps: 0,
    prospectsByStatus: [],
    salesPerformance: [],
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 1))
      .toISOString()
      .split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);

  useEffect(() => {
    loadReportData();
  }, [dateRange]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      const [prospectsData, followUpsData, salesData] = await Promise.all([
        api.listProspects({ startDate: dateRange.start, endDate: dateRange.end }),
        api.listFollowUps({ startDate: dateRange.start, endDate: dateRange.end }),
        api.listProfiles('sales'),
      ]);

      if (prospectsData) setProspects(prospectsData);
      if (followUpsData) setFollowUps(followUpsData);

      const prospectsByStatus = [
        {
          status: 'menunggu_follow_up',
          count: prospectsData?.filter((p) => p.status === 'menunggu_follow_up').length || 0,
        },
        {
          status: 'dalam_follow_up',
          count: prospectsData?.filter((p) => p.status === 'dalam_follow_up').length || 0,
        },
        {
          status: 'selesai',
          count: prospectsData?.filter((p) => p.status === 'selesai').length || 0,
        },
      ];

      const salesPerformance =
        salesData?.map((sales) => ({
          sales,
          prospectsCount: prospectsData?.filter((p) => p.sales_id === sales.id).length || 0,
          completedFollowUps:
            followUpsData?.filter(
              (f) => f.assigned_to === sales.id && f.status === 'completed'
            ).length || 0,
        })) || [];

      setReportData({
        totalProspects: prospectsData?.length || 0,
        totalFollowUps: followUpsData?.length || 0,
        completedFollowUps: followUpsData?.filter((f) => f.status === 'completed').length || 0,
        pendingFollowUps:
          followUpsData?.filter((f) => f.status === 'pending' || f.status === 'in_progress')
            .length || 0,
        prospectsByStatus,
        salesPerformance,
      });
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const csvContent = [
      ['Laporan Prospek dan Follow-Up'],
      ['Periode:', `${dateRange.start} s/d ${dateRange.end}`],
      [''],
      ['RINGKASAN'],
      ['Total Prospek', reportData.totalProspects],
      ['Total Follow-Up', reportData.totalFollowUps],
      ['Follow-Up Selesai', reportData.completedFollowUps],
      ['Follow-Up Pending', reportData.pendingFollowUps],
      [''],
      ['PROSPEK BERDASARKAN STATUS'],
      ['Status', 'Jumlah'],
      ...reportData.prospectsByStatus.map((item) => [
        item.status.replace('_', ' ').toUpperCase(),
        item.count,
      ]),
      [''],
      ['PERFORMA SALES'],
      ['Nama Sales', 'Total Prospek', 'Follow-Up Selesai'],
      ...reportData.salesPerformance.map((item) => [
        item.sales.full_name,
        item.prospectsCount,
        item.completedFollowUps,
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `laporan_${dateRange.start}_${dateRange.end}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          <h1 className="text-2xl font-bold text-gray-900">Laporan</h1>
          <p className="text-gray-600 mt-1">Laporan prospek dan follow-up</p>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
        >
          <Download className="w-5 h-5" />
          Export CSV
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-700" />
          <h2 className="text-lg font-semibold text-gray-900">Filter Periode</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tanggal Mulai
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tanggal Akhir
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Prospek</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {reportData.totalProspects}
              </p>
            </div>
            <div className="bg-blue-50 p-3 rounded-xl">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Follow-Up</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {reportData.totalFollowUps}
              </p>
            </div>
            <div className="bg-purple-50 p-3 rounded-xl">
              <Calendar className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Follow-Up Selesai</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {reportData.completedFollowUps}
              </p>
            </div>
            <div className="bg-green-50 p-3 rounded-xl">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Follow-Up Pending</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {reportData.pendingFollowUps}
              </p>
            </div>
            <div className="bg-orange-50 p-3 rounded-xl">
              <Calendar className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Prospek Berdasarkan Status</h2>
          <div className="space-y-3">
            {reportData.prospectsByStatus.map((item) => (
              <div key={item.status} className="flex items-center justify-between">
                <span className="text-gray-700 capitalize">
                  {item.status.replace('_', ' ')}
                </span>
                <span className="font-semibold text-gray-900">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Performa Sales</h2>
          <div className="space-y-3">
            {reportData.salesPerformance.length === 0 ? (
              <p className="text-sm text-gray-500">Belum ada data sales</p>
            ) : (
              reportData.salesPerformance.map((item) => (
                <div key={item.sales.id} className="flex items-center justify-between">
                  <span className="text-gray-700">{item.sales.full_name}</span>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Prospek: {item.prospectsCount}</p>
                    <p className="text-sm text-gray-500">
                      Follow-Up Selesai: {item.completedFollowUps}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
