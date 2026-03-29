'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Users,
  MessageSquare,
  Calendar,
  Send,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'
import PhoneMockup from '@/components/PhoneMockup'
import { createBroadcast } from '@/lib/api'

const searchTypes = ['مطعم', 'كافيه', 'صيدلية', 'سوبرماركت', 'صالون', 'مستشفى', 'بنك', 'مسجد']
const durationOptions = [
  { value: 7, label: '7 أيام' },
  { value: 30, label: '30 يوم' },
  { value: 90, label: '90 يوم' },
]

// Fake audience count calculation
function calcAudience(type: string, searchType: string, region: string, days: number) {
  let base = 4827
  if (type === 'search_type') base = Math.floor(base * 0.45)
  if (type === 'region') base = Math.floor(base * 0.3)
  if (days === 7) base = Math.floor(base * 0.4)
  else if (days === 30) base = Math.floor(base * 0.7)
  // Anti-spam: remove ~15%
  const afterSpam = Math.floor(base * 0.85)
  return { raw: base, filtered: afterSpam }
}

export default function NewBroadcastPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [audienceType, setAudienceType] = useState<'all' | 'search_type' | 'region'>('all')
  const [searchType, setSearchType] = useState(searchTypes[0])
  const [region, setRegion] = useState('')
  const [days, setDays] = useState(30)
  const [message, setMessage] = useState('')
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now')
  const [scheduleDate, setScheduleDate] = useState('')

  const maxChars = 1000
  const audience = calcAudience(audienceType, searchType, region, days)

  const canProceed = () => {
    if (step === 1) return name.trim().length > 0
    if (step === 2) return true
    if (step === 3) return message.trim().length > 0
    return true
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await createBroadcast({
        name,
        message,
        targetAudience: {
          type: audienceType,
          searchType: audienceType === 'search_type' ? searchType : undefined,
          region: audienceType === 'region' ? region : undefined,
          withinDays: days,
        },
        schedule: scheduleType === 'now' ? 'now' : scheduleDate,
      })
      setSubmitted(true)
    } catch {
      setError('تعذّر إنشاء الحملة. يرجى المحاولة مجدداً.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={40} className="text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">تم إنشاء الحملة!</h2>
        <p className="text-slate-500 mb-6">
          {scheduleType === 'now'
            ? 'جاري إرسال الحملة الآن إلى الجمهور المستهدف.'
            : `تم جدولة الحملة للإرسال في ${scheduleDate || 'الوقت المحدد'}.`}
        </p>
        <button onClick={() => router.push('/broadcasts')} className="btn-primary">
          <ArrowRight size={16} />
          العودة للحملات
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => (step === 1 ? router.push('/broadcasts') : setStep((s) => s - 1))}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <ArrowRight size={20} className="text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">حملة جديدة</h1>
          <p className="text-sm text-slate-500 mt-0.5">الخطوة {step} من 4</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="admin-card p-4">
        <div className="flex items-center gap-0">
          {[
            { num: 1, label: 'الاسم' },
            { num: 2, label: 'الجمهور' },
            { num: 3, label: 'الرسالة' },
            { num: 4, label: 'الجدولة' },
          ].map(({ num, label }, i, arr) => (
            <div key={num} className="flex items-center flex-1">
              <button
                onClick={() => num < step && setStep(num)}
                className="flex flex-col items-center gap-1.5 group"
                disabled={num > step}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    step === num
                      ? 'text-white shadow-lg'
                      : num < step
                      ? 'bg-green-100 text-green-600'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                  style={step === num ? { background: 'linear-gradient(135deg, #25D366, #128C7E)' } : {}}
                >
                  {num < step ? <CheckCircle size={16} /> : num}
                </div>
                <span
                  className={`text-xs font-medium hidden sm:block ${
                    step === num ? 'text-green-600' : num < step ? 'text-green-500' : 'text-slate-400'
                  }`}
                >
                  {label}
                </span>
              </button>
              {i < arr.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 transition-all ${
                    num < step ? 'bg-green-200' : 'bg-slate-100'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Step 1: Name */}
          {step === 1 && (
            <div className="admin-card p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
                <MessageSquare size={18} className="text-green-500" />
                اسم الحملة
              </h2>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                اسم الحملة <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="مثال: عروض رمضان 2024"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input"
                autoFocus
              />
              <p className="text-xs text-slate-400 mt-2">
                اختر اسماً وصفياً يساعدك على التعرف على الحملة لاحقاً
              </p>
            </div>
          )}

          {/* Step 2: Audience */}
          {step === 2 && (
            <div className="admin-card p-6 space-y-5">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Users size={18} className="text-green-500" />
                الجمهور المستهدف
              </h2>

              {/* Audience Type */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-3">
                  نوع الاستهداف
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { value: 'all', label: 'الكل', desc: 'جميع المستخدمين' },
                    { value: 'search_type', label: 'من بحث عن', desc: 'حسب نوع البحث' },
                    { value: 'region', label: 'في منطقة', desc: 'حسب المنطقة' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setAudienceType(opt.value as typeof audienceType)}
                      className={`p-4 rounded-xl border-2 text-right transition-all ${
                        audienceType === opt.value
                          ? 'border-green-400 bg-green-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <p
                        className={`font-semibold text-sm ${
                          audienceType === opt.value ? 'text-green-700' : 'text-slate-700'
                        }`}
                      >
                        {opt.label}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional fields */}
              {audienceType === 'search_type' && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    نوع البحث
                  </label>
                  <select
                    value={searchType}
                    onChange={(e) => setSearchType(e.target.value)}
                    className="form-input"
                  >
                    {searchTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {audienceType === 'region' && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    اسم المنطقة
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: الرياض، جدة، الدمام..."
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="form-input"
                  />
                </div>
              )}

              {/* Duration Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  المستخدمون الذين بحثوا خلال
                </label>
                <div className="flex gap-2 flex-wrap">
                  {durationOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setDays(opt.value)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                        days === opt.value
                          ? 'border-green-400 bg-green-50 text-green-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Anti-spam Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700 font-medium">
                  سيصل لـ{' '}
                  <strong>{audience.filtered.toLocaleString('ar-SA')}</strong> شخص من أصل{' '}
                  <strong>{audience.raw.toLocaleString('ar-SA')}</strong>{' '}
                  (فلتر السبام فعّال — تم استثناء من تلقى رسالة مؤخراً)
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Message */}
          {step === 3 && (
            <div className="admin-card p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <MessageSquare size={18} className="text-green-500" />
                محتوى الرسالة
              </h2>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-600">
                    نص الرسالة <span className="text-red-400">*</span>
                  </label>
                  <span
                    className={`text-xs font-medium ${
                      message.length > maxChars ? 'text-red-500' : 'text-slate-400'
                    }`}
                  >
                    {message.length} / {maxChars}
                  </span>
                </div>
                <textarea
                  rows={6}
                  placeholder="اكتب نص رسالتك هنا...&#10;&#10;مثال: مرحباً! 🌟 اكتشف أفضل المطاعم القريبة منك اليوم مع وين أروح."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="form-input resize-none"
                  maxLength={maxChars}
                />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs text-amber-700">
                  <strong>نصائح للرسالة الفعّالة:</strong> ابدأ بالاسم أو تحية ودية ✓ اذكر الفائدة
                  مباشرة ✓ أضف إيموجي باعتدال ✓ أنهِ بدعوة للتفاعل
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Schedule */}
          {step === 4 && (
            <div className="admin-card p-6 space-y-5">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Calendar size={18} className="text-green-500" />
                وقت الإرسال
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { value: 'now', label: 'الآن', desc: 'إرسال فوري' },
                  { value: 'later', label: 'لاحقاً', desc: 'جدولة للمستقبل' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setScheduleType(opt.value as 'now' | 'later')}
                    className={`p-5 rounded-xl border-2 text-right transition-all ${
                      scheduleType === opt.value
                        ? 'border-green-400 bg-green-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <p
                      className={`font-bold text-base ${
                        scheduleType === opt.value ? 'text-green-700' : 'text-slate-700'
                      }`}
                    >
                      {opt.label}
                    </p>
                    <p className="text-sm text-slate-500 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>

              {scheduleType === 'later' && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    تاريخ ووقت الإرسال
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="form-input"
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>
              )}

              {/* Summary */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-bold text-slate-700 mb-3">ملخص الحملة</h3>
                {[
                  { label: 'الاسم', value: name },
                  {
                    label: 'الجمهور',
                    value:
                      audienceType === 'all'
                        ? 'الكل'
                        : audienceType === 'search_type'
                        ? `من بحث عن: ${searchType}`
                        : `منطقة: ${region || '—'}`,
                  },
                  {
                    label: 'الوصول المتوقع',
                    value: `${audience.filtered.toLocaleString('ar-SA')} شخص`,
                  },
                  {
                    label: 'وقت الإرسال',
                    value: scheduleType === 'now' ? 'الآن' : scheduleDate || 'غير محدد',
                  },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{item.label}</span>
                    <span className="font-medium text-slate-700">{item.value}</span>
                  </div>
                ))}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 font-medium">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={() => (step === 1 ? router.push('/broadcasts') : setStep((s) => s - 1))}
              className="btn-secondary"
            >
              {step === 1 ? 'إلغاء' : 'السابق'}
            </button>
            {step < 4 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canProceed()}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                التالي
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || !message.trim()}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={16} className={submitting ? 'animate-pulse' : ''} />
                {submitting ? 'جاري الإرسال...' : 'إرسال الحملة'}
              </button>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <div className="admin-card p-4">
            <h3 className="text-sm font-bold text-slate-700 mb-4">معاينة الرسالة</h3>
            <PhoneMockup
              message={message || 'سيظهر نص رسالتك هنا عند الكتابة...'}
            />
          </div>

          {step >= 2 && (
            <div className="admin-card p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3">تقدير الوصول</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">الجمهور المستهدف</span>
                  <span className="font-bold text-slate-800">
                    {audience.raw.toLocaleString('ar-SA')}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">بعد فلتر السبام</span>
                  <span className="font-bold text-green-600">
                    {audience.filtered.toLocaleString('ar-SA')}
                  </span>
                </div>
                <div className="bar-track mt-1">
                  <div
                    className="bar-fill"
                    style={{ width: `${Math.round((audience.filtered / audience.raw) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
