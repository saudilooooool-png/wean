'use client'

import { useEffect, useState } from 'react'
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Store,
  X,
  MapPin,
  Tag,
  DollarSign,
  MessageSquare,
  ChevronDown,
} from 'lucide-react'
import {
  getAdvertisers,
  approveAdvertiser,
  rejectAdvertiser,
  type Advertiser,
  type AdvertiserApprovalPayload,
} from '@/lib/api'

const categories = ['مطعم', 'كافيه', 'صيدلية', 'سوبرماركت', 'صالون', 'مستشفى', 'بنك', 'أخرى']

export default function AdvertisersPage() {
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'pending' | 'active'>('pending')
  const [approveTarget, setApproveTarget] = useState<Advertiser | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Advertiser | null>(null)
  const [approvalData, setApprovalData] = useState<AdvertiserApprovalPayload>({
    durationDays: 30,
    maxSendsPerWeek: 50,
    serviceFee: 200,
  })
  const [actionLoading, setActionLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // حالة نموذج التسجيل الذاتي
  const [showSelfService, setShowSelfService] = useState(false)
  const [selfForm, setSelfForm] = useState({
    name: '',
    category: categories[0],
    location: '',
    adMessage: '',
    budget: '',
  })

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getAdvertisers()
      setAdvertisers(data)
    } catch {
      setError('تعذّر تحميل بيانات المعلنين.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const pending = advertisers.filter((a) => a.status === 'pending')
  const active = advertisers.filter((a) => a.status === 'active')

  const handleApprove = async () => {
    if (!approveTarget) return
    setActionLoading(true)
    try {
      await approveAdvertiser(approveTarget.id, approvalData)
      setAdvertisers((prev) =>
        prev.map((a) =>
          a.id === approveTarget.id
            ? {
                ...a,
                status: 'active' as const,
                campaignStatus: 'active' as const,
                maxSendsPerWeek: approvalData.maxSendsPerWeek,
                serviceFee: approvalData.serviceFee,
                subscriptionEnds: new Date(
                  Date.now() + approvalData.durationDays * 86400000
                )
                  .toISOString()
                  .slice(0, 10),
              }
            : a
        )
      )
      setSuccessMsg(`تم قبول ${approveTarget.name} بنجاح`)
      setApproveTarget(null)
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch {
      setError('فشلت عملية القبول.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectTarget) return
    setActionLoading(true)
    try {
      await rejectAdvertiser(rejectTarget.id)
      setAdvertisers((prev) =>
        prev.map((a) =>
          a.id === rejectTarget.id ? { ...a, status: 'rejected' as const } : a
        )
      )
      setSuccessMsg(`تم رفض طلب ${rejectTarget.name}`)
      setRejectTarget(null)
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch {
      setError('فشلت عملية الرفض.')
    } finally {
      setActionLoading(false)
    }
  }

  const formatDate = (iso?: string) => {
    if (!iso) return '—'
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

  const campaignStatusMap = {
    active: { label: 'نشطة', class: 'badge-green' },
    paused: { label: 'موقوفة', class: 'badge-yellow' },
    ended: { label: 'منتهية', class: 'badge-gray' },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">المعلنون</h1>
          <p className="text-sm text-slate-500 mt-0.5">إدارة طلبات وحملات المعلنين</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSelfService(true)}
            className="btn-secondary text-sm"
          >
            <Store size={15} />
            نموذج المعلن
          </button>
          <button onClick={load} disabled={loading} className="btn-secondary text-sm">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Success / Error */}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700 font-medium flex items-center gap-2">
          <CheckCircle size={16} />
          {successMsg}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
          <p className="text-red-600 text-sm font-medium">{error}</p>
          <button onClick={load} className="btn-danger text-xs">
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="admin-card overflow-hidden">
        <div className="flex border-b border-slate-100">
          {([
            { key: 'pending', label: 'طلبات جديدة', count: pending.length },
            { key: 'active', label: 'معلنون نشطون', count: active.length },
          ] as const).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 px-4 py-3.5 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                activeTab === key
                  ? 'text-green-600 border-b-2 border-green-500 bg-green-50/50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {label}
              <span
                className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center ${
                  activeTab === key ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* Pending Table */}
        {activeTab === 'pending' && (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الفئة</th>
                  <th>المنطقة</th>
                  <th>الميزانية</th>
                  <th>تاريخ الطلب</th>
                  <th>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [...Array(3)].map((_, i) => (
                      <tr key={i}>
                        {[...Array(6)].map((_, j) => (
                          <td key={j}>
                            <div className="skeleton h-4 w-full max-w-24 rounded" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : pending.map((adv) => (
                      <tr key={adv.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                            >
                              {adv.name.charAt(0)}
                            </div>
                            <span className="font-semibold text-slate-700">{adv.name}</span>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-blue">{adv.category}</span>
                        </td>
                        <td className="text-slate-600 text-sm">{adv.region}</td>
                        <td>
                          <span className="font-bold text-slate-700">
                            {adv.budget.toLocaleString('ar-SA')}
                          </span>
                          <span className="text-xs text-slate-400 me-1">ر.س/شهر</span>
                        </td>
                        <td className="text-slate-500 text-sm">{formatDate(adv.requestedAt)}</td>
                        <td>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setApproveTarget(adv)}
                              className="btn-primary text-xs py-1.5 px-3"
                            >
                              <CheckCircle size={13} />
                              قبول
                            </button>
                            <button
                              onClick={() => setRejectTarget(adv)}
                              className="btn-danger text-xs py-1.5 px-3"
                            >
                              <XCircle size={13} />
                              رفض
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
            {!loading && pending.length === 0 && (
              <div className="text-center py-12">
                <CheckCircle size={40} className="text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400">لا توجد طلبات معلقة</p>
              </div>
            )}
          </div>
        )}

        {/* Active Advertisers Table */}
        {activeTab === 'active' && (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الفئة</th>
                  <th>المنطقة</th>
                  <th>حالة الحملة</th>
                  <th>الحد الأسبوعي</th>
                  <th>انتهاء الاشتراك</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [...Array(3)].map((_, i) => (
                      <tr key={i}>
                        {[...Array(6)].map((_, j) => (
                          <td key={j}>
                            <div className="skeleton h-4 w-full max-w-24 rounded" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : active.map((adv) => {
                      const cs = adv.campaignStatus
                        ? campaignStatusMap[adv.campaignStatus]
                        : campaignStatusMap.active
                      return (
                        <tr key={adv.id}>
                          <td>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                                style={{
                                  background: 'linear-gradient(135deg, #25D366, #128C7E)',
                                }}
                              >
                                {adv.name.charAt(0)}
                              </div>
                              <span className="font-semibold text-slate-700">{adv.name}</span>
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-blue">{adv.category}</span>
                          </td>
                          <td className="text-slate-600 text-sm">{adv.region}</td>
                          <td>
                            <span className={`badge ${cs.class}`}>{cs.label}</span>
                          </td>
                          <td className="text-slate-700 font-medium">
                            {adv.maxSendsPerWeek ?? '—'}
                            <span className="text-xs text-slate-400 me-1">رسالة</span>
                          </td>
                          <td>
                            <span
                              className={`text-sm font-medium ${
                                adv.subscriptionEnds &&
                                new Date(adv.subscriptionEnds) < new Date()
                                  ? 'text-red-500'
                                  : 'text-slate-600'
                              }`}
                            >
                              {formatDate(adv.subscriptionEnds)}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
              </tbody>
            </table>
            {!loading && active.length === 0 && (
              <div className="text-center py-12">
                <Store size={40} className="text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400">لا يوجد معلنون نشطون</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Approve Modal */}
      {approveTarget && (
        <div className="modal-overlay" onClick={() => setApproveTarget(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">قبول المعلن</h3>
              <button
                onClick={() => setApproveTarget(null)}
                className="p-2 rounded-lg hover:bg-slate-100"
              >
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-green-50 rounded-xl p-3">
                <p className="font-bold text-green-700">{approveTarget.name}</p>
                <p className="text-sm text-green-600">
                  {approveTarget.category} · {approveTarget.region}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  مدة الحملة
                </label>
                <div className="flex gap-2">
                  {[7, 14, 30].map((d) => (
                    <button
                      key={d}
                      onClick={() => setApprovalData((prev) => ({ ...prev, durationDays: d }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                        approvalData.durationDays === d
                          ? 'border-green-400 bg-green-50 text-green-700'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {d} يوم
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  الحد الأقصى للإرسال (رسائل/أسبوع)
                </label>
                <input
                  type="number"
                  value={approvalData.maxSendsPerWeek}
                  onChange={(e) =>
                    setApprovalData((prev) => ({
                      ...prev,
                      maxSendsPerWeek: Number(e.target.value),
                    }))
                  }
                  className="form-input"
                  min={1}
                  max={500}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  رسوم الخدمة (ر.س)
                </label>
                <input
                  type="number"
                  value={approvalData.serviceFee}
                  onChange={(e) =>
                    setApprovalData((prev) => ({
                      ...prev,
                      serviceFee: Number(e.target.value),
                    }))
                  }
                  className="form-input"
                  min={0}
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setApproveTarget(null)} className="btn-secondary text-sm">
                إلغاء
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="btn-primary text-sm"
              >
                <CheckCircle size={15} />
                {actionLoading ? 'جاري القبول...' : 'تأكيد القبول'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Confirmation Modal */}
      {rejectTarget && (
        <div className="modal-overlay" onClick={() => setRejectTarget(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle size={32} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">رفض الطلب</h3>
              <p className="text-sm text-slate-500 mb-6">
                هل أنت متأكد من رفض طلب <strong>{rejectTarget.name}</strong>؟ لا يمكن التراجع عن
                هذا القرار.
              </p>
              <div className="flex justify-center gap-3">
                <button onClick={() => setRejectTarget(null)} className="btn-secondary text-sm">
                  إلغاء
                </button>
                <button
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="btn-danger text-sm"
                >
                  <XCircle size={15} />
                  {actionLoading ? 'جاري الرفض...' : 'تأكيد الرفض'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Self-Service Form Modal */}
      {showSelfService && (
        <div className="modal-overlay" onClick={() => setShowSelfService(false)}>
          <div
            className="modal-content max-w-lg w-full"
            style={{ maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-slate-800">نموذج المعلن الذاتي</h3>
              <button
                onClick={() => setShowSelfService(false)}
                className="p-2 rounded-lg hover:bg-slate-100"
              >
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-500">
                هذا النموذج سيُستخدم في بوابة المعلنين العامة للتسجيل الذاتي.
              </p>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1">
                  <Store size={13} />
                  اسم المنشأة
                </label>
                <input
                  type="text"
                  placeholder="مثال: مطعم الأصالة"
                  value={selfForm.name}
                  onChange={(e) => setSelfForm((p) => ({ ...p, name: e.target.value }))}
                  className="form-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1">
                  <Tag size={13} />
                  الفئة
                </label>
                <div className="relative">
                  <select
                    value={selfForm.category}
                    onChange={(e) => setSelfForm((p) => ({ ...p, category: e.target.value }))}
                    className="form-input appearance-none"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute top-1/2 -translate-y-1/2 start-3 text-slate-400 pointer-events-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1">
                  <MapPin size={13} />
                  الموقع الجغرافي
                </label>
                <input
                  type="text"
                  placeholder="المدينة والحي"
                  value={selfForm.location}
                  onChange={(e) => setSelfForm((p) => ({ ...p, location: e.target.value }))}
                  className="form-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1">
                  <MessageSquare size={13} />
                  رسالة الإعلان
                </label>
                <textarea
                  rows={3}
                  placeholder="اكتب رسالتك الإعلانية..."
                  value={selfForm.adMessage}
                  onChange={(e) => setSelfForm((p) => ({ ...p, adMessage: e.target.value }))}
                  className="form-input resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1">
                  <DollarSign size={13} />
                  الميزانية الشهرية (ر.س)
                </label>
                <input
                  type="number"
                  placeholder="مثال: 500"
                  value={selfForm.budget}
                  onChange={(e) => setSelfForm((p) => ({ ...p, budget: e.target.value }))}
                  className="form-input"
                  min={0}
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setShowSelfService(false)} className="btn-secondary text-sm">
                إغلاق
              </button>
              <button className="btn-primary text-sm">إرسال الطلب</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
