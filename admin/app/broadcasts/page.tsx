'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Plus,
  RefreshCw,
  Send,
  Clock,
  FileText,
  CheckCircle,
  Eye,
  MessageSquare,
  Megaphone,
} from 'lucide-react'
import { getBroadcasts, type Broadcast } from '@/lib/api'

const statusMap = {
  sent: { label: 'أُرسل', class: 'badge-green', icon: CheckCircle },
  scheduled: { label: 'مجدول', class: 'badge-yellow', icon: Clock },
  draft: { label: 'مسودة', class: 'badge-gray', icon: FileText },
}

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

  const formatDate = (iso?: string) => {
    if (!iso) return '—'
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

  const getReadRate = (b: Broadcast) => {
    if (!b.sentCount) return '—'
    return `${Math.round((b.readCount / b.sentCount) * 100)}%`
  }

  const getReplyRate = (b: Broadcast) => {
    if (!b.sentCount) return '—'
    return `${Math.round((b.replyCount / b.sentCount) * 100)}%`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">الحملات</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            إدارة حملات البث عبر واتساب
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="btn-secondary text-sm">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <Link href="/broadcasts/new" className="btn-primary text-sm">
            <Plus size={16} />
            حملة جديدة
          </Link>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
          <p className="text-red-600 text-sm font-medium">{error}</p>
          <button onClick={load} className="btn-danger text-xs">
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Summary Cards */}
      {!loading && broadcasts.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'إجمالي الحملات',
              value: broadcasts.length,
              color: 'bg-blue-50 text-blue-700',
            },
            {
              label: 'تم الإرسال',
              value: broadcasts.filter((b) => b.status === 'sent').length,
              color: 'bg-green-50 text-green-700',
            },
            {
              label: 'مجدولة',
              value: broadcasts.filter((b) => b.status === 'scheduled').length,
              color: 'bg-yellow-50 text-yellow-700',
            },
            {
              label: 'مسودات',
              value: broadcasts.filter((b) => b.status === 'draft').length,
              color: 'bg-slate-50 text-slate-700',
            },
          ].map((item, i) => (
            <div key={i} className={`admin-card p-4 ${item.color}`}>
              <p className="text-2xl font-bold">{item.value}</p>
              <p className="text-xs font-medium mt-0.5 opacity-80">{item.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Broadcasts List */}
      <div className="space-y-4">
        {loading
          ? [...Array(3)].map((_, i) => (
              <div key={i} className="admin-card p-5">
                <div className="flex items-start gap-4">
                  <div className="skeleton w-12 h-12 rounded-xl" />
                  <div className="flex-1">
                    <div className="skeleton h-4 w-40 mb-2" />
                    <div className="skeleton h-3 w-56 mb-3" />
                    <div className="flex gap-4">
                      {[...Array(3)].map((_, j) => (
                        <div key={j} className="skeleton h-3 w-16" />
                      ))}
                    </div>
                  </div>
                  <div className="skeleton h-6 w-16 rounded-full" />
                </div>
              </div>
            ))
          : broadcasts.map((b) => {
              const sm = statusMap[b.status]
              const StatusIcon = sm.icon
              return (
                <div
                  key={b.id}
                  className="admin-card p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-wrap items-start gap-4">
                    {/* Icon */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background:
                          b.status === 'sent'
                            ? '#dcfce7'
                            : b.status === 'scheduled'
                            ? '#fef9c3'
                            : '#f1f5f9',
                      }}
                    >
                      <Megaphone
                        size={22}
                        className={
                          b.status === 'sent'
                            ? 'text-green-600'
                            : b.status === 'scheduled'
                            ? 'text-yellow-600'
                            : 'text-slate-400'
                        }
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-base font-bold text-slate-800">{b.name}</h3>
                        <span className={`badge ${sm.class} gap-1`}>
                          <StatusIcon size={11} />
                          {sm.label}
                        </span>
                      </div>

                      {b.message && (
                        <p className="text-sm text-slate-500 mb-3 line-clamp-1">{b.message}</p>
                      )}

                      {/* Stats Row */}
                      <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-1.5 text-sm text-slate-600">
                          <Send size={13} className="text-slate-400" />
                          <span className="font-medium">
                            {b.sentCount.toLocaleString('ar-SA')}
                          </span>
                          <span className="text-slate-400">أُرسل</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-slate-600">
                          <Eye size={13} className="text-slate-400" />
                          <span className="font-medium">{getReadRate(b)}</span>
                          <span className="text-slate-400">قُرئ</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-slate-600">
                          <MessageSquare size={13} className="text-slate-400" />
                          <span className="font-medium">{getReplyRate(b)}</span>
                          <span className="text-slate-400">رد</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-slate-600">
                          <Clock size={13} className="text-slate-400" />
                          <span className="text-slate-400">
                            {b.status === 'sent'
                              ? formatDate(b.sentAt)
                              : b.status === 'scheduled'
                              ? `مجدول: ${formatDate(b.scheduledAt)}`
                              : 'مسودة'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Target */}
                    <div className="text-left flex-shrink-0">
                      <p className="text-xs text-slate-400 mb-0.5">الجمهور المستهدف</p>
                      <p className="text-base font-bold text-slate-700">
                        {b.targetCount.toLocaleString('ar-SA')}
                        <span className="text-xs font-normal text-slate-400 me-1">شخص</span>
                      </p>
                    </div>
                  </div>

                  {/* Progress bar for sent campaigns */}
                  {b.status === 'sent' && b.sentCount > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                        <span>معدل التسليم</span>
                        <span>
                          {Math.round((b.sentCount / b.targetCount) * 100)}%
                        </span>
                      </div>
                      <div className="bar-track h-2">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${Math.round((b.sentCount / b.targetCount) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

        {!loading && broadcasts.length === 0 && (
          <div className="admin-card p-16 text-center">
            <Megaphone size={48} className="text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500 font-medium mb-2">لا توجد حملات حتى الآن</p>
            <p className="text-sm text-slate-400 mb-4">ابدأ أول حملة بث لمستخدميك</p>
            <Link href="/broadcasts/new" className="btn-primary text-sm">
              <Plus size={16} />
              إنشاء حملة جديدة
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
