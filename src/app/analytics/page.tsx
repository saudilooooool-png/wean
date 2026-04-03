'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, Users, Clock, Search, RefreshCw, Download, BarChart3, PieChart } from 'lucide-react'
import { getAnalytics, type AnalyticsData } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week')

  const load = async () => {
    setLoading(true)
    try {
      const analytics = await getAnalytics(period)
      setData(analytics)
    } catch {
      // Use defaults
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [period])

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toLocaleString('ar-SA')
  }

  const maxSearches = Math.max(...(data?.searchesByHour.map(h => h.count) || [1]))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">التحليلات</h1>
          <p className="text-sm text-slate-500 mt-0.5">إحصائيات وأداء المنصة</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={load} disabled={loading} variant="outline" size="sm">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download size={15} />
            تصدير
          </Button>
        </div>
      </div>

      {/* Period Tabs */}
      <Tabs value={period} onValueChange={(v) => setPeriod(v as any)}>
        <TabsList>
          <TabsTrigger value="day">اليوم</TabsTrigger>
          <TabsTrigger value="week">الأسبوع</TabsTrigger>
          <TabsTrigger value="month">الشهر</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">عمليات البحث</p>
                {loading ? (
                  <div className="skeleton h-8 w-20 mt-2" />
                ) : (
                  <p className="text-2xl font-bold text-slate-800 mt-2">{formatNumber(data?.searches || 0)}</p>
                )}
                <p className="text-xs text-green-600 mt-1">+12% عن الفترة السابقة</p>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600">
                <Search size={20} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">المستخدمون النشطون</p>
                {loading ? (
                  <div className="skeleton h-8 w-20 mt-2" />
                ) : (
                  <p className="text-2xl font-bold text-slate-800 mt-2">{formatNumber(data?.users || 0)}</p>
                )}
                <p className="text-xs text-green-600 mt-1">+8% عن الفترة السابقة</p>
              </div>
              <div className="p-2.5 rounded-xl bg-green-100 text-green-600">
                <Users size={20} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">متوسط وقت الاستجابة</p>
                {loading ? (
                  <div className="skeleton h-8 w-20 mt-2" />
                ) : (
                  <p className="text-2xl font-bold text-slate-800 mt-2">{data?.avgResponseTime || 0}s</p>
                )}
                <p className="text-xs text-green-600 mt-1">ممتاز</p>
              </div>
              <div className="p-2.5 rounded-xl bg-purple-100 text-purple-600">
                <Clock size={20} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">معدل النمو</p>
                {loading ? (
                  <div className="skeleton h-8 w-20 mt-2" />
                ) : (
                  <p className="text-2xl font-bold text-slate-800 mt-2">+23%</p>
                )}
                <p className="text-xs text-green-600 mt-1">نمو مستمر</p>
              </div>
              <div className="p-2.5 rounded-xl bg-orange-100 text-orange-600">
                <TrendingUp size={20} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Searches by Hour */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <BarChart3 size={16} className="text-slate-400" />
              عمليات البحث حسب الساعة
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="skeleton h-48 w-full" />
            ) : (
              <div className="h-48 flex items-end gap-1">
                {data?.searchesByHour.map((hour, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-green-500 to-green-400 rounded-t-sm transition-all duration-300 hover:from-green-600 hover:to-green-500 cursor-pointer group relative"
                    style={{ height: `${(hour.count / maxSearches) * 100}%` }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {hour.count} بحث
                    </div>
                    {hour.hour % 6 === 0 && (
                      <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-slate-400">
                        {hour.hour}:00
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Queries */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <PieChart size={16} className="text-slate-400" />
              أكثر عمليات البحث
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
                {data?.topQueries.map((query, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium text-slate-700">{query.query}</span>
                    </div>
                    <Badge variant="secondary">{formatNumber(query.count)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">إحصائيات مفصلة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[
              { label: 'مطاعم', value: 1247, color: 'bg-orange-500' },
              { label: 'كافيهات', value: 876, color: 'bg-amber-500' },
              { label: 'صيدليات', value: 376, color: 'bg-green-500' },
              { label: 'سوبرماركت', value: 281, color: 'bg-blue-500' },
              { label: 'مساجد', value: 188, color: 'bg-purple-500' },
              { label: 'أخرى', value: 156, color: 'bg-slate-500' },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className={`w-12 h-12 rounded-xl ${item.color} mx-auto mb-2 flex items-center justify-center text-white font-bold`}>
                  {Math.round((item.value / 3124) * 100)}%
                </div>
                <p className="text-sm font-medium text-slate-700">{item.label}</p>
                <p className="text-xs text-slate-500">{item.value.toLocaleString('ar-SA')}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
