'use client'

import { useEffect, useState } from 'react'
import { Plus, Send, Clock, Users, CheckCircle, XCircle, Calendar, RefreshCw, Trash2, Edit, Play, Pause } from 'lucide-react'
import { getBroadcasts, type Broadcast } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

export default function BroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getBroadcasts()
      setBroadcasts(data)
    } catch {
      setError('تعذّر تحميل الحملات.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const formatTime = (iso?: string) => {
    if (!iso) return '-'
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

  const getStatusBadge = (status: Broadcast['status']) => {
    const statusMap = {
      draft: { label: 'مسودة', variant: 'secondary' as const },
      scheduled: { label: 'مجدولة', variant: 'default' as const, className: 'bg-blue-100 text-blue-700' },
      sending: { label: 'جاري الإرسال', variant: 'default' as const, className: 'bg-orange-100 text-orange-700' },
      sent: { label: 'مُرسلة', variant: 'default' as const, className: 'bg-green-100 text-green-700' },
      failed: { label: 'فشلت', variant: 'destructive' as const },
    }
    const s = statusMap[status]
    return <Badge variant={s.variant} className={s.className}>{s.label}</Badge>
  }

  const stats = {
    total: broadcasts.length,
    sent: broadcasts.filter(b => b.status === 'sent').length,
    scheduled: broadcasts.filter(b => b.status === 'scheduled').length,
    draft: broadcasts.filter(b => b.status === 'draft').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">الحملات الإعلانية</h1>
          <p className="text-sm text-slate-500 mt-0.5">إدارة حملات الرسائل الجماعية</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={load} disabled={loading} variant="outline" size="sm">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Link href="/broadcasts/new">
            <Button className="bg-green-600 hover:bg-green-700 gap-2">
              <Plus size={16} />
              حملة جديدة
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
            <p className="text-xs text-slate-500 mt-1">إجمالي الحملات</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.sent}</p>
            <p className="text-xs text-slate-500 mt-1">تم إرسالها</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.scheduled}</p>
            <p className="text-xs text-slate-500 mt-1">مجدولة</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-slate-500">{stats.draft}</p>
            <p className="text-xs text-slate-500 mt-1">مسودات</p>
          </CardContent>
        </Card>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
          <p className="text-red-600 text-sm font-medium">{error}</p>
          <Button onClick={load} variant="destructive" size="sm">
            إعادة المحاولة
          </Button>
        </div>
      )}

      {/* Broadcasts List */}
      <div className="space-y-4">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="space-y-3">
                  <div className="skeleton h-5 w-48" />
                  <div className="skeleton h-4 w-full" />
                  <div className="skeleton h-4 w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : broadcasts.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Send size={40} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 mb-4">لا توجد حملات بعد</p>
              <Link href="/broadcasts/new">
                <Button className="bg-green-600 hover:bg-green-700 gap-2">
                  <Plus size={16} />
                  إنشاء حملة جديدة
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          broadcasts.map((broadcast) => (
            <Card key={broadcast.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-slate-800">{broadcast.name}</h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {broadcast.status === 'scheduled' && broadcast.scheduledAt && (
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            مجدولة: {formatTime(broadcast.scheduledAt)}
                          </span>
                        )}
                        {broadcast.status === 'sent' && broadcast.sentAt && (
                          <span className="flex items-center gap-1">
                            <CheckCircle size={12} />
                            أُرسلت: {formatTime(broadcast.sentAt)}
                          </span>
                        )}
                      </p>
                    </div>
                    {getStatusBadge(broadcast.status)}
                  </div>

                  <p className="text-sm text-slate-600 line-clamp-2 mb-4">
                    {broadcast.message || 'لا يوجد نص'}
                  </p>

                  {/* Progress Stats */}
                  {broadcast.status !== 'draft' && (
                    <div className="grid grid-cols-4 gap-3 mb-4">
                      <div className="bg-slate-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-slate-800">{broadcast.targetCount}</p>
                        <p className="text-xs text-slate-500">المستهدفون</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-green-600">{broadcast.sentCount}</p>
                        <p className="text-xs text-slate-500">تم الإرسال</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-blue-600">{broadcast.readCount}</p>
                        <p className="text-xs text-slate-500">قرأت</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-purple-600">{broadcast.replyCount}</p>
                        <p className="text-xs text-slate-500">ردود</p>
                      </div>
                    </div>
                  )}

                  {/* Progress Bar */}
                  {broadcast.status === 'sending' && broadcast.targetCount > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span>التقدم</span>
                        <span>{Math.round((broadcast.sentCount / broadcast.targetCount) * 100)}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all duration-500"
                          style={{ width: `${(broadcast.sentCount / broadcast.targetCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {broadcast.status === 'draft' && (
                      <>
                        <Link href={`/broadcasts/new?id=${broadcast.id}`}>
                          <Button size="sm" variant="outline" className="gap-1">
                            <Edit size={14} />
                            تعديل
                          </Button>
                        </Link>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1">
                          <Send size={14} />
                          إرسال الآن
                        </Button>
                      </>
                    )}
                    {broadcast.status === 'scheduled' && (
                      <>
                        <Button size="sm" variant="outline" className="gap-1">
                          <Pause size={14} />
                          إلغاء الجدولة
                        </Button>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1">
                          <Play size={14} />
                          إرسال الآن
                        </Button>
                      </>
                    )}
                    {broadcast.status === 'sent' && (
                      <Button size="sm" variant="outline" className="gap-1">
                        <Users size={14} />
                        عرض التفاصيل
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
