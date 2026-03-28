'use client'

import { useEffect, useState } from 'react'
import { Users, Search, Store, MessageSquare, RefreshCw, Clock } from 'lucide-react'
import StatCard from '@/components/StatCard'
import { getStats, getContacts, type Stats, type Contact } from '@/lib/api'

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentContacts, setRecentContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [barsVisible, setBarsVisible] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, c] = await Promise.all([getStats(), getContacts(1, '')])
      setStats(s)
      setRecentContacts(c.contacts.slice(0, 5))
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

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('ar-SA', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">لوحة التحكم</h1>
          <p className="text-sm text-slate-500 mt-0.5">مرحباً بك في منصة وين أروح</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="btn-secondary text-sm"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          تحديث
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
          <p className="text-red-600 text-sm font-medium">{error}</p>
          <button onClick={load} className="btn-danger text-xs">
            إعادة المحاولة
          </button>
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
        <div className="admin-card p-6 lg:col-span-3">
          <h2 className="text-base font-bold text-slate-800 mb-5">أكثر الأماكن بحثاً</h2>
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
        </div>

        {/* Recent Activity */}
        <div className="admin-card p-6 lg:col-span-2">
          <h2 className="text-base font-bold text-slate-800 mb-4">آخر عمليات البحث</h2>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="skeleton w-8 h-8 rounded-full" />
                  <div className="flex-1">
                    <div className="skeleton h-3 w-24 mb-2" />
                    <div className="skeleton h-2.5 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {recentContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}
                  >
                    {contact.phone.slice(-2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">
                      {contact.phone}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{contact.lastSearch}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Clock size={10} className="text-slate-400" />
                      <span className="text-xs text-slate-400">
                        {formatTime(contact.joinedAt)}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`badge text-xs flex-shrink-0 ${
                      contact.status === 'active' ? 'badge-green' : 'badge-red'
                    }`}
                  >
                    {contact.status === 'active' ? 'نشط' : 'موقوف'}
                  </span>
                </div>
              ))}
              {recentContacts.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-6">لا توجد بيانات حديثة</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'متوسط البحوث / مستخدم', value: loading ? '...' : '4.7' },
          { label: 'معدل الرد على الرسائل', value: loading ? '...' : '68%' },
          { label: 'المستخدمون الجدد اليوم', value: loading ? '...' : '37' },
          { label: 'وقت الاستجابة (ثانية)', value: loading ? '...' : '0.8' },
        ].map((item, i) => (
          <div key={i} className="admin-card p-4 text-center">
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
          </div>
        ))}
      </div>
    </div>
  )
}
