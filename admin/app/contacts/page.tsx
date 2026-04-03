'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Search,
  Download,
  X,
  ChevronRight,
  ChevronLeft,
  Clock,
  MessageSquare,
  StickyNote,
  RefreshCw,
  User,
  BellOff,
} from 'lucide-react'
import { getContacts, type Contact, type ContactsResponse } from '@/lib/api'

export default function ContactsPage() {
  const [data, setData] = useState<ContactsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [debouncedFilter, setDebouncedFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Contact | null>(null)
  const [noteText, setNoteText] = useState('')
  const [directMsg, setDirectMsg] = useState('')
  const [msgSent, setMsgSent] = useState(false)

  // تأخير البحث لتحسين الأداء
  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilter(filter), 400)
    return () => clearTimeout(t)
  }, [filter])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getContacts(page, debouncedFilter)
      setData(res)
    } catch {
      setError('تعذّر تحميل جهات الاتصال.')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedFilter])

  useEffect(() => {
    setPage(1)
  }, [debouncedFilter])

  useEffect(() => {
    load()
  }, [load])

  const exportCSV = () => {
    if (!data?.contacts.length) return
    const headers = ['الرقم', 'آخر بحث', 'عدد البحوث', 'المنطقة', 'تاريخ الانضمام', 'الحالة']
    const rows = data.contacts.map((c) => [
      c.phone,
      c.lastSearch,
      c.searchCount,
      c.region,
      c.joinedAt,
      c.status === 'active' ? 'نشط' : 'موقوف الإشعارات',
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return iso
    }
  }

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

  const sendDirectMessage = () => {
    if (!directMsg.trim()) return
    setMsgSent(true)
    setDirectMsg('')
    setTimeout(() => setMsgSent(false), 3000)
  }

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">جهات الاتصال</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {data ? `${data.total.toLocaleString('ar-SA')} جهة اتصال` : 'جاري التحميل...'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} disabled={!data?.contacts.length} className="btn-secondary text-sm">
            <Download size={15} />
            تصدير CSV
          </button>
          <button onClick={load} disabled={loading} className="btn-secondary text-sm">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="admin-card p-3">
        <div className="relative">
          <Search
            size={16}
            className="absolute top-1/2 -translate-y-1/2 end-3 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="ابحث برقم الهاتف أو المنطقة أو نوع البحث..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="form-input pe-9"
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              className="absolute top-1/2 -translate-y-1/2 start-3 text-slate-400 hover:text-slate-600"
            >
              <X size={15} />
            </button>
          )}
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

      {/* Table */}
      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>الرقم</th>
                <th>آخر بحث</th>
                <th>عدد البحوث</th>
                <th>المنطقة</th>
                <th>تاريخ الانضمام</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? [...Array(8)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(6)].map((_, j) => (
                        <td key={j}>
                          <div className="skeleton h-4 w-full max-w-24 rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                : data?.contacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(contact)}
                    >
                      <td>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}
                          >
                            {contact.phone.slice(-2)}
                          </div>
                          <span className="font-mono text-sm" dir="ltr">
                            {contact.phone}
                          </span>
                        </div>
                      </td>
                      <td className="text-slate-600">{contact.lastSearch}</td>
                      <td>
                        <span className="badge badge-blue">{contact.searchCount}</span>
                      </td>
                      <td className="text-slate-600">{contact.region}</td>
                      <td className="text-slate-500 text-sm">{formatDate(contact.joinedAt)}</td>
                      <td>
                        {contact.status === 'opted_out' ? (
                          <span className="badge badge-red gap-1">
                            <BellOff size={11} />
                            أوقف الإشعارات
                          </span>
                        ) : (
                          <span className="badge badge-green">نشط</span>
                        )}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
          {!loading && data?.contacts.length === 0 && (
            <div className="text-center py-12">
              <User size={40} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400">لا توجد نتائج مطابقة</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-sm text-slate-500">
              صفحة {page} من {data.pages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronRight size={15} className="text-slate-600" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page === data.pages || loading}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft size={15} className="text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Side Panel Overlay */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/40 z-30"
          onClick={() => setSelected(null)}
        />
      )}

      {/* Side Panel */}
      <div className={`side-panel ${selected ? 'open' : ''}`} style={{ right: 'auto', left: 0 }}>
        {selected && (
          <>
            {/* Panel Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
              <button
                onClick={() => setSelected(null)}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={18} className="text-slate-500" />
              </button>
              <h2 className="text-base font-bold text-slate-800">تفاصيل المستخدم</h2>
            </div>

            <div className="p-5 space-y-6">
              {/* User Info */}
              <div className="text-center">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3"
                  style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}
                >
                  {selected.phone.slice(-2)}
                </div>
                <p className="font-bold text-slate-800 text-lg font-mono" dir="ltr">
                  {selected.phone}
                </p>
                <p className="text-sm text-slate-500">{selected.region}</p>
                <div className="mt-2">
                  {selected.status === 'opted_out' ? (
                    <span className="badge badge-red">
                      <BellOff size={11} />
                      أوقف الإشعارات
                    </span>
                  ) : (
                    <span className="badge badge-green">مستخدم نشط</span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'عدد البحوث', value: selected.searchCount },
                  { label: 'تاريخ الانضمام', value: formatDate(selected.joinedAt) },
                ].map((item, i) => (
                  <div key={i} className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-slate-800">{item.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.label}</p>
                  </div>
                ))}
              </div>

              {/* Search History */}
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <Clock size={14} className="text-slate-400" />
                  سجل البحوث
                </h3>
                <div className="space-y-2">
                  {(selected.searchHistory ?? []).map((rec, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{rec.query}</p>
                        <p className="text-xs text-slate-400">{formatTime(rec.timestamp)}</p>
                      </div>
                      <span className="badge badge-blue text-xs">{rec.results} نتائج</span>
                    </div>
                  ))}
                  {(!selected.searchHistory || selected.searchHistory.length === 0) && (
                    <p className="text-sm text-slate-400 text-center py-3">لا يوجد سجل بحث</p>
                  )}
                </div>
              </div>

              {/* Direct Message */}
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <MessageSquare size={14} className="text-slate-400" />
                  إرسال رسالة مباشرة
                </h3>
                {msgSent && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-3 text-sm text-green-700 font-medium">
                    تم إرسال الرسالة بنجاح
                  </div>
                )}
                <textarea
                  rows={3}
                  placeholder="اكتب رسالتك هنا..."
                  value={directMsg}
                  onChange={(e) => setDirectMsg(e.target.value)}
                  className="form-input resize-none mb-2"
                />
                <button onClick={sendDirectMessage} className="btn-primary w-full text-sm justify-center">
                  <MessageSquare size={15} />
                  إرسال عبر واتساب
                </button>
              </div>

              {/* Note */}
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <StickyNote size={14} className="text-slate-400" />
                  ملاحظة
                </h3>
                <textarea
                  rows={3}
                  placeholder="أضف ملاحظة على هذا المستخدم..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="form-input resize-none mb-2"
                />
                <button
                  onClick={() => setNoteText('')}
                  className="btn-secondary w-full text-sm justify-center"
                >
                  حفظ الملاحظة
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
