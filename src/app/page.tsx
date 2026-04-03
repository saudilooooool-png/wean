'use client'

import { useEffect, useState } from 'react'
import { Users, Search, Store, MessageSquare, RefreshCw, Clock, TrendingUp, TrendingDown, MapPin, ChevronLeft } from 'lucide-react'
import { getStats, type Stats } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [barsVisible, setBarsVisible] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const s = await getStats()
      setStats(s)
      setTimeout(() => setBarsVisible(true), 100)
    } catch {
      setError('تعذّر تحميل البيانات. يرجى المحاولة مجدداً.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toLocaleString('ar-SA')
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">لوحة التحكم</h1>
          <p className="text-sm text-slate-500 mt-0.5">مرحباً بك في منصة وين أروح</p>
        </div>
        <Button
          onClick={load}
          disabled={loading}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          تحديث
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
          <p className="text-red-600 text-sm font-medium">{error}</p>
          <Button onClick={load} variant="destructive" size="sm">
            إعادة المحاولة
          </Button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="إجمالي المتواصلين"
          value={stats?.totalContacts ?? 0}
          icon={Users}
          color="green"
          change="+12% هذا الشهر"
          changeType="up"
          loading={loading}
        />
        <StatCard
          title="عمليات البحث اليوم"
          value={stats?.searchesToday ?? 0}
          icon={Search}
          color="blue"
          change="+8% عن أمس"
          changeType="up"
          loading={loading}
        />
        <StatCard
          title="المعلنين النشطين"
          value={stats?.activeAdvertisers ?? 0}
          icon={Store}
          color="orange"
          loading={loading}
        />
        <StatCard
          title="الرسائل المرسلة"
          value={stats?.messagesSent ?? 0}
          icon={MessageSquare}
          color="purple"
          change="+23% هذا الأسبوع"
          changeType="up"
          loading={loading}
        />
      </div>

      {/* Charts + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Bar Chart */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">أكثر الأماكن بحثاً</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="skeleton h-3 w-20" />
                    <div className="skeleton h-3 flex-1" />
                    <div className="skeleton h-3 w-10" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="bar-chart-container">
                {(stats?.topPlaces ?? []).map((place, i) => (
                  <div key={i} className="bar-row">
                    <span className="bar-label">{place.label}</span>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{
                          width: barsVisible ? `${place.percentage}%` : '0%',
                          transitionDelay: `${i * 100}ms`,
                        }}
                      />
                    </div>
                    <span className="bar-value">{place.percentage}%</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Searches by City */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <MapPin size={16} className="text-slate-400" />
              البحث حسب المدينة
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="skeleton h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {(stats?.searchesByCity ?? []).map((city, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <span className="text-sm font-medium text-slate-700">{city.city}</span>
                    <span className="badge badge-blue">{formatNumber(city.count)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'متوسط البحوث / مستخدم', value: '4.7', icon: TrendingUp },
          { label: 'معدل الرد على الرسائل', value: '68%', icon: TrendingUp },
          { label: 'المستخدمون الجدد اليوم', value: '37', icon: Users },
          { label: 'وقت الاستجابة (ثانية)', value: '0.8', icon: Clock },
        ].map((item, i) => (
          <Card key={i}>
            <CardContent className="p-4 text-center">
              {loading ? (
                <>
                  <div className="skeleton h-6 w-12 mx-auto mb-2" />
                  <div className="skeleton h-3 w-24 mx-auto" />
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-slate-800">{item.value}</p>
                  <p className="text-xs text-slate-500 mt-1">{item.label}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">إجراءات سريعة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/broadcasts/new">
              <Button className="w-full h-20 flex-col gap-2 bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700">
                <MessageSquare size={20} />
                <span className="text-sm">حملة جديدة</span>
              </Button>
            </Link>
            <Link href="/contacts">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <Users size={20} />
                <span className="text-sm">جهات الاتصال</span>
              </Button>
            </Link>
            <Link href="/analytics">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <TrendingUp size={20} />
                <span className="text-sm">التحليلات</span>
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <Store size={20} />
                <span className="text-sm">الإعدادات</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Stat Card Component
function StatCard({
  title,
  value,
  icon: Icon,
  color,
  change,
  changeType,
  loading,
}: {
  title: string
  value: number
  icon: React.ComponentType<{ size?: number; className?: string }>
  color: 'green' | 'blue' | 'orange' | 'purple'
  change?: string
  changeType?: 'up' | 'down'
  loading?: boolean
}) {
  const colorClasses = {
    green: 'bg-green-100 text-green-600',
    blue: 'bg-blue-100 text-blue-600',
    orange: 'bg-orange-100 text-orange-600',
    purple: 'bg-purple-100 text-purple-600',
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toLocaleString('ar-SA')
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-slate-500 font-medium">{title}</p>
            {loading ? (
              <div className="skeleton h-8 w-20" />
            ) : (
              <p className="text-2xl font-bold text-slate-800">{formatNumber(value)}</p>
            )}
            {change && !loading && (
              <div className={`flex items-center gap-1 text-xs font-medium ${changeType === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                {changeType === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {change}
              </div>
            )}
          </div>
          <div className={`p-2.5 rounded-xl ${colorClasses[color]}`}>
            <Icon size={20} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
