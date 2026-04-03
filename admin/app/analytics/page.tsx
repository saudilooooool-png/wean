'use client'

import { useState, useEffect } from 'react'
import { 
  TrendingUp, TrendingDown, Users, Search, MessageSquare, 
  Clock, BarChart3, PieChart, Calendar, RefreshCw, Download
} from 'lucide-react'

interface DailyStats {
  date: string
  searches: number
  newUsers: number
  messages: number
}

interface CategoryStats {
  category: string
  count: number
  percentage: number
}

interface CityStats {
  city: string
  count: number
  percentage: number
}

const mockDailyStats: DailyStats[] = [
  { date: '2024-01-01', searches: 1250, newUsers: 45, messages: 890 },
  { date: '2024-01-02', searches: 1380, newUsers: 52, messages: 920 },
  { date: '2024-01-03', searches: 1190, newUsers: 38, messages: 750 },
  { date: '2024-01-04', searches: 1520, newUsers: 61, messages: 1100 },
  { date: '2024-01-05', searches: 1680, newUsers: 72, messages: 1250 },
  { date: '2024-01-06', searches: 1890, newUsers: 85, messages: 1420 },
  { date: '2024-01-07', searches: 2100, newUsers: 98, messages: 1580 },
]

const mockCategoryStats: CategoryStats[] = [
  { category: 'مطاعم', count: 4500, percentage: 35 },
  { category: 'مقاهي', count: 2800, percentage: 22 },
  { category: 'حدائق', count: 1900, percentage: 15 },
  { category: 'تسوق', count: 1600, percentage: 12 },
  { category: 'معالم سياحية', count: 1200, percentage: 9 },
  { category: 'أخرى', count: 800, percentage: 7 },
]

const mockCityStats: CityStats[] = [
  { city: 'الرياض', count: 5200, percentage: 32 },
  { city: 'جدة', count: 4100, percentage: 25 },
  { city: 'الخبر', count: 2300, percentage: 14 },
  { city: 'الدمام', count: 1900, percentage: 12 },
  { city: 'مكة', count: 1500, percentage: 9 },
  { city: 'المدينة', count: 1200, percentage: 8 },
]

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [dailyStats] = useState<DailyStats[]>(mockDailyStats)
  const [categoryStats] = useState<CategoryStats[]>(mockCategoryStats)
  const [cityStats] = useState<CityStats[]>(mockCityStats)
  const [timeRange, setTimeRange] = useState('7d')

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 800)
    return () => clearTimeout(timer)
  }, [])

  const totalSearches = dailyStats.reduce((sum, d) => sum + d.searches, 0)
  const totalNewUsers = dailyStats.reduce((sum, d) => sum + d.newUsers, 0)
  const totalMessages = dailyStats.reduce((sum, d) => sum + d.messages, 0)
  const avgResponseTime = 0.8

  const StatCard = ({ 
    title, 
    value, 
    change, 
    changeType, 
    icon: Icon, 
    color 
  }: { 
    title: string
    value: string | number
    change: string
    changeType: 'up' | 'down'
    icon: React.ComponentType<{ size: number; className?: string }>
    color: string
  }) => (
    <div className="admin-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 mb-1">{title}</p>
          {loading ? (
            <div className="skeleton h-7 w-20" />
          ) : (
            <p className="text-2xl font-bold text-slate-800">{value}</p>
          )}
        </div>
        <div className={`p-2.5 rounded-xl ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
      {!loading && (
        <div className="flex items-center gap-1 mt-3">
          {changeType === 'up' ? (
            <TrendingUp size={14} className="text-green-500" />
          ) : (
            <TrendingDown size={14} className="text-red-500" />
          )}
          <span className={`text-xs font-medium ${changeType === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {change}
          </span>
          <span className="text-xs text-slate-400">عن الفترة السابقة</span>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">التحليلات</h1>
          <p className="text-sm text-slate-500 mt-0.5">إحصائيات وأداء المنصة</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none text-sm"
          >
            <option value="24h">آخر 24 ساعة</option>
            <option value="7d">آخر 7 أيام</option>
            <option value="30d">آخر 30 يوم</option>
            <option value="90d">آخر 90 يوم</option>
          </select>
          <button className="btn-secondary text-sm">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            تحديث
          </button>
          <button className="btn-primary text-sm">
            <Download size={15} />
            تصدير
          </button>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="إجمالي عمليات البحث"
          value={totalSearches.toLocaleString()}
          change="+18%"
          changeType="up"
          icon={Search}
          color="bg-gradient-to-br from-blue-400 to-blue-600"
        />
        <StatCard
          title="المستخدمون الجدد"
          value={totalNewUsers.toLocaleString()}
          change="+24%"
          changeType="up"
          icon={Users}
          color="bg-gradient-to-br from-green-400 to-green-600"
        />
        <StatCard
          title="الرسائل المرسلة"
          value={totalMessages.toLocaleString()}
          change="+12%"
          changeType="up"
          icon={MessageSquare}
          color="bg-gradient-to-br from-purple-400 to-purple-600"
        />
        <StatCard
          title="متوسط وقت الاستجابة"
          value={`${avgResponseTime}ث`}
          change="-15%"
          changeType="up"
          icon={Clock}
          color="bg-gradient-to-br from-orange-400 to-orange-600"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Activity Chart */}
        <div className="admin-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-slate-800">النشاط اليومي</h2>
            <BarChart3 size={18} className="text-slate-400" />
          </div>
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="skeleton w-full h-full" />
            </div>
          ) : (
            <div className="h-64">
              {/* Simple Bar Chart */}
              <div className="flex items-end justify-between h-48 gap-2">
                {dailyStats.map((day, i) => {
                  const maxSearches = Math.max(...dailyStats.map(d => d.searches))
                  const height = (day.searches / maxSearches) * 100
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <div 
                        className="w-full bg-gradient-to-t from-green-500 to-green-400 rounded-t-lg transition-all duration-500"
                        style={{ height: `${height}%` }}
                        title={`${day.searches} بحث`}
                      />
                      <span className="text-xs text-slate-400">
                        {new Date(day.date).toLocaleDateString('ar-SA', { weekday: 'short' })}
                      </span>
                    </div>
                  )
                })}
              </div>
              {/* Legend */}
              <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-green-500" />
                  <span className="text-xs text-slate-500">عمليات البحث</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Categories Distribution */}
        <div className="admin-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-slate-800">توزيع البحث حسب التصنيف</h2>
            <PieChart size={18} className="text-slate-400" />
          </div>
          {loading ? (
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton h-3 w-20" />
                  <div className="skeleton h-3 flex-1" />
                  <div className="skeleton h-3 w-10" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {categoryStats.map((cat, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-20 text-sm text-slate-600 truncate">{cat.category}</span>
                  <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-l from-green-500 to-green-400 rounded-full transition-all duration-500"
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                  <span className="w-12 text-sm text-slate-500 text-left">{cat.percentage}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cities Stats */}
      <div className="admin-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-slate-800">أكثر المدن نشاطاً</h2>
          <Calendar size={18} className="text-slate-400" />
        </div>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="text-center">
                <div className="skeleton h-12 w-12 mx-auto rounded-full mb-2" />
                <div className="skeleton h-4 w-16 mx-auto" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {cityStats.map((city, i) => (
              <div key={i} className="text-center p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                <div 
                  className="w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ 
                    background: `linear-gradient(135deg, hsl(${140 + i * 20}, 70%, 50%), hsl(${140 + i * 20}, 70%, 40%))` 
                  }}
                >
                  {city.city.charAt(0)}
                </div>
                <p className="text-sm font-semibold text-slate-700">{city.city}</p>
                <p className="text-xs text-slate-500 mt-1">{city.count.toLocaleString()} بحث</p>
                <p className="text-xs text-green-600 font-medium mt-1">{city.percentage}%</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="admin-card p-5">
          <h3 className="text-sm font-semibold text-slate-600 mb-4">معدل الاستجابة</h3>
          <div className="flex items-center justify-center">
            <div className="relative w-32 h-32">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="#e2e8f0"
                  strokeWidth="12"
                  fill="none"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="url(#gradient)"
                  strokeWidth="12"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${95 * 3.51} ${100 * 3.51}`}
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#16a34a" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-slate-800">95%</span>
              </div>
            </div>
          </div>
          <p className="text-center text-sm text-slate-500 mt-4">من الرسائل يتم الرد عليها</p>
        </div>

        <div className="admin-card p-5">
          <h3 className="text-sm font-semibold text-slate-600 mb-4">رضا المستخدمين</h3>
          <div className="flex items-center justify-center">
            <div className="relative w-32 h-32">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="#e2e8f0"
                  strokeWidth="12"
                  fill="none"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="url(#gradient2)"
                  strokeWidth="12"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${87 * 3.51} ${100 * 3.51}`}
                />
                <defs>
                  <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#2563eb" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-slate-800">87%</span>
              </div>
            </div>
          </div>
          <p className="text-center text-sm text-slate-500 mt-4">تقييم إيجابي للخدمة</p>
        </div>

        <div className="admin-card p-5">
          <h3 className="text-sm font-semibold text-slate-600 mb-4">دقة النتائج</h3>
          <div className="flex items-center justify-center">
            <div className="relative w-32 h-32">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="#e2e8f0"
                  strokeWidth="12"
                  fill="none"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="url(#gradient3)"
                  strokeWidth="12"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${92 * 3.51} ${100 * 3.51}`}
                />
                <defs>
                  <linearGradient id="gradient3" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#9333ea" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-slate-800">92%</span>
              </div>
            </div>
          </div>
          <p className="text-center text-sm text-slate-500 mt-4">نتائج بحث دقيقة</p>
        </div>
      </div>
    </div>
  )
}
