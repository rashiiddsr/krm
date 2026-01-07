import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { Users, ClipboardList, CheckCircle, Clock, TrendingUp, AlertCircle } from 'lucide-react';

interface Stats {
  totalProspects: number;
  pendingFollowUps: number;
  completedFollowUps: number;
  totalSales: number;
}

interface RecentActivity {
  id: string;
  type: string;
  description: string;
  time: string;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalProspects: 0,
    pendingFollowUps: 0,
    completedFollowUps: 0,
    totalSales: 0,
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [profile]);

  const loadDashboardData = async () => {
    if (!profile) return;

    try {
      if (profile.role === 'admin') {
        const [prospects, followUps, sales, notifications] = await Promise.all([
          api.listProspects({}),
          api.listFollowUps({}),
          api.listProfiles('sales'),
          api.listNotifications({ userId: profile.id, limit: 5 }),
        ]);

        const pendingFollowUps =
          followUps?.filter((f) => f.status === 'pending' || f.status === 'in_progress').length || 0;
        const completedFollowUps =
          followUps?.filter((f) => f.status === 'completed').length || 0;

        setStats({
          totalProspects: prospects?.length || 0,
          pendingFollowUps,
          completedFollowUps,
          totalSales: sales?.length || 0,
        });

        if (notifications) {
          setRecentActivities(
            notifications.map((n) => ({
              id: n.id,
              type: n.type,
              description: n.message,
              time: new Date(n.created_at).toLocaleString('id-ID'),
            }))
          );
        }
      } else {
        const [prospects, followUps, notifications] = await Promise.all([
          api.listProspects({ salesId: profile.id }),
          api.listFollowUps({ assignedTo: profile.id }),
          api.listNotifications({ userId: profile.id, limit: 5 }),
        ]);

        const pendingFollowUps =
          followUps?.filter((f) => f.status === 'pending' || f.status === 'in_progress').length || 0;
        const completedFollowUps =
          followUps?.filter((f) => f.status === 'completed').length || 0;

        setStats({
          totalProspects: prospects?.length || 0,
          pendingFollowUps,
          completedFollowUps,
          totalSales: 0,
        });

        if (notifications) {
          setRecentActivities(
            notifications.map((n) => ({
              id: n.id,
              type: n.type,
              description: n.message,
              time: new Date(n.created_at).toLocaleString('id-ID'),
            }))
          );
        }
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const statCards =
    profile?.role === 'admin'
      ? [
          {
            title: 'Total Prospek',
            value: stats.totalProspects,
            icon: Users,
            color: 'bg-blue-500',
            bgColor: 'bg-blue-50',
          },
          {
            title: 'Follow-Up Pending',
            value: stats.pendingFollowUps,
            icon: Clock,
            color: 'bg-orange-500',
            bgColor: 'bg-orange-50',
          },
          {
            title: 'Follow-Up Selesai',
            value: stats.completedFollowUps,
            icon: CheckCircle,
            color: 'bg-green-500',
            bgColor: 'bg-green-50',
          },
          {
            title: 'Total Sales',
            value: stats.totalSales,
            icon: TrendingUp,
            color: 'bg-purple-500',
            bgColor: 'bg-purple-50',
          },
        ]
      : [
          {
            title: 'Prospek Saya',
            value: stats.totalProspects,
            icon: Users,
            color: 'bg-blue-500',
            bgColor: 'bg-blue-50',
          },
          {
            title: 'Follow-Up Pending',
            value: stats.pendingFollowUps,
            icon: Clock,
            color: 'bg-orange-500',
            bgColor: 'bg-orange-50',
          },
          {
            title: 'Follow-Up Selesai',
            value: stats.completedFollowUps,
            icon: CheckCircle,
            color: 'bg-green-500',
            bgColor: 'bg-green-50',
          },
        ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Selamat Datang, {profile?.full_name}
        </h1>
        <p className="text-gray-600 mt-1">Berikut adalah ringkasan aktivitas hari ini</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                </div>
                <div className={`${stat.bgColor} p-3 rounded-xl`}>
                  <Icon className={`w-8 h-8 ${stat.color.replace('bg-', 'text-')}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="w-5 h-5 text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">Aktivitas Terbaru</h2>
          </div>
          <div className="space-y-4">
            {recentActivities.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>Belum ada aktivitas</p>
              </div>
            ) : (
              recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 pb-4 border-b border-gray-100 last:border-0"
                >
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{activity.description}</p>
                    <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 text-white">
          <h2 className="text-lg font-semibold mb-4">Tips Hari Ini</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <p className="text-sm">
                Pastikan untuk melakukan follow-up prospek secara rutin untuk meningkatkan konversi
              </p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <p className="text-sm">
                Catat setiap interaksi dengan prospek untuk tracking yang lebih baik
              </p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <p className="text-sm">
                Jadwalkan follow-up di waktu yang tepat untuk hasil maksimal
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
