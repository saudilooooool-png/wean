'use client'

import { useEffect, useState } from 'react'
import {
  Search,
  MessageSquare,
  ShieldAlert,
  Info,
  Save,
  RefreshCw,
  CheckCircle,
  Sliders,
  Clock,
  Hash,
} from 'lucide-react'
import { getSettings, saveSettings, type AppSettings } from '@/lib/api'
import PhoneMockup from '@/components/PhoneMockup'

const defaultSettings: AppSettings = {
  search: { radius: 2000, maxResults: 5 },
  botMessages: {
    welcome: 'أهلاً بك في وين أروح! 👋\nأنا مساعدك لاكتشاف أفضل الأماكن القريبة منك.',
    prompt: 'ماذا تريد أن تجد؟ (مطعم، كافيه، صيدلية...)\nأرسل موقعك أولاً للحصول على أفضل النتائج.',
  },
  antiSpam: { maxPerWeek: 3, sendFrom: '08:00', sendTo: '22:00' },
  platform: { botName: 'وين أروح', description: 'خدمة البحث عن الأماكن القريبة عبر واتساب' },
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getSettings()
      setSettings(data)
    } catch {
      setError('تعذّر تحميل الإعدادات.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveSettings(settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('تعذّر حفظ الإعدادات.')
    } finally {
      setSaving(false)
    }
  }

  const update = <K extends keyof AppSettings>(
    section: K,
    key: keyof AppSettings[K],
    value: AppSettings[K][keyof AppSettings[K]]
  ) => {
    setSettings((prev) => ({
      ...prev,
      [section]: { ...prev[section], [key]: value },
    }))
  }

  const radiusLabel = (v: number) => {
    if (v < 1000) return `${v} م`
    return `${(v / 1000).toFixed(1)} كم`
  }

  const SectionTitle = ({
    icon: Icon,
    title,
    subtitle,
  }: {
    icon: React.ElementType
    title: string
    subtitle: string
  }) => (
    <div className="flex items-start gap-3 mb-5">
      <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={18} className="text-green-600" />
      </div>
      <div>
        <h2 className="text-base font-bold text-slate-800">{title}</h2>
        <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">الإعدادات</h1>
          <p className="text-sm text-slate-500 mt-0.5">إعدادات المنصة وسلوك البوت</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="btn-secondary text-sm">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={handleSave} disabled={saving || loading} className="btn-primary text-sm">
            {saved ? (
              <>
                <CheckCircle size={15} />
                تم الحفظ
              </>
            ) : (
              <>
                <Save size={15} className={saving ? 'animate-pulse' : ''} />
                {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600 font-medium">
          {error}
        </div>
      )}

      {/* Saved notification */}
      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700 font-medium flex items-center gap-2">
          <CheckCircle size={16} />
          تم حفظ الإعدادات بنجاح
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Search Settings */}
          <div className="admin-card p-6">
            <SectionTitle
              icon={Search}
              title="إعدادات البحث"
              subtitle="التحكم في نطاق وعدد نتائج البحث"
            />
            {loading ? (
              <div className="space-y-5">
                <div className="skeleton h-12 w-full rounded-xl" />
                <div className="skeleton h-12 w-full rounded-xl" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Radius Slider */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                      <Sliders size={14} className="text-slate-400" />
                      نصف القطر
                    </label>
                    <span className="text-sm font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full">
                      {radiusLabel(settings.search.radius)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={500}
                    max={10000}
                    step={100}
                    value={settings.search.radius}
                    onChange={(e) => update('search', 'radius', Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>10 كم</span>
                    <span>500 م</span>
                  </div>
                </div>

                {/* Max Results */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3 flex items-center gap-1.5">
                    <Hash size={14} className="text-slate-400" />
                    عدد النتائج المعروضة
                  </label>
                  <div className="flex gap-3">
                    {[3, 5, 10].map((n) => (
                      <button
                        key={n}
                        onClick={() => update('search', 'maxResults', n)}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                          settings.search.maxResults === n
                            ? 'border-green-400 bg-green-50 text-green-700'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bot Messages */}
          <div className="admin-card p-6">
            <SectionTitle
              icon={MessageSquare}
              title="رسائل البوت"
              subtitle="تخصيص رسائل البوت الآلية للمستخدمين"
            />
            {loading ? (
              <div className="space-y-4">
                <div className="skeleton h-24 w-full rounded-xl" />
                <div className="skeleton h-24 w-full rounded-xl" />
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    رسالة الترحيب
                  </label>
                  <textarea
                    rows={3}
                    value={settings.botMessages.welcome}
                    onChange={(e) => update('botMessages', 'welcome', e.target.value)}
                    className="form-input resize-none"
                    placeholder="رسالة الترحيب عند بدء المحادثة..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    رسالة "اكتب ماذا تريد"
                  </label>
                  <textarea
                    rows={3}
                    value={settings.botMessages.prompt}
                    onChange={(e) => update('botMessages', 'prompt', e.target.value)}
                    className="form-input resize-none"
                    placeholder="رسالة توجيه المستخدم لإدخال طلبه..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Anti-Spam */}
          <div className="admin-card p-6">
            <SectionTitle
              icon={ShieldAlert}
              title="مكافحة السبام"
              subtitle="قيود الإرسال لمنع الإزعاج وضمان جودة التجربة"
            />
            {loading ? (
              <div className="space-y-4">
                <div className="skeleton h-12 w-full rounded-xl" />
                <div className="skeleton h-12 w-48 rounded-xl" />
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
                    <Hash size={14} className="text-slate-400" />
                    الحد الأقصى للرسائل الإعلانية في الأسبوع
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={settings.antiSpam.maxPerWeek}
                      onChange={(e) =>
                        update('antiSpam', 'maxPerWeek', Number(e.target.value))
                      }
                      className="form-input w-28"
                      min={1}
                      max={20}
                    />
                    <span className="text-sm text-slate-500">رسالة / أسبوع / مستخدم</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3 flex items-center gap-1.5">
                    <Clock size={14} className="text-slate-400" />
                    ساعات الإرسال المسموح بها
                  </label>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">من</span>
                      <input
                        type="time"
                        value={settings.antiSpam.sendFrom}
                        onChange={(e) => update('antiSpam', 'sendFrom', e.target.value)}
                        className="form-input w-32"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">إلى</span>
                      <input
                        type="time"
                        value={settings.antiSpam.sendTo}
                        onChange={(e) => update('antiSpam', 'sendTo', e.target.value)}
                        className="form-input w-32"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    لن يتم إرسال أي رسائل إعلانية خارج هذا النطاق الزمني
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Platform Info */}
          <div className="admin-card p-6">
            <SectionTitle
              icon={Info}
              title="معلومات المنصة"
              subtitle="الاسم والوصف الظاهر للمستخدمين"
            />
            {loading ? (
              <div className="space-y-4">
                <div className="skeleton h-12 w-full rounded-xl" />
                <div className="skeleton h-12 w-full rounded-xl" />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    اسم البوت
                  </label>
                  <input
                    type="text"
                    value={settings.platform.botName}
                    onChange={(e) => update('platform', 'botName', e.target.value)}
                    className="form-input"
                    placeholder="وين أروح"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    وصف قصير
                  </label>
                  <input
                    type="text"
                    value={settings.platform.description}
                    onChange={(e) => update('platform', 'description', e.target.value)}
                    className="form-input"
                    placeholder="وصف موجز للخدمة..."
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Preview + Summary */}
        <div className="space-y-4">
          {/* Bot Message Preview */}
          <div className="admin-card p-4">
            <h3 className="text-sm font-bold text-slate-700 mb-4">معاينة رسالة الترحيب</h3>
            <PhoneMockup
              message={settings.botMessages.welcome}
              botName={settings.platform.botName}
            />
          </div>

          {/* Settings Summary */}
          <div className="admin-card p-4">
            <h3 className="text-sm font-bold text-slate-700 mb-3">ملخص الإعدادات</h3>
            <div className="space-y-2.5">
              {[
                { label: 'نطاق البحث', value: radiusLabel(settings.search.radius) },
                { label: 'عدد النتائج', value: `${settings.search.maxResults} نتائج` },
                {
                  label: 'حد الإرسال',
                  value: `${settings.antiSpam.maxPerWeek} رسالة/أسبوع`,
                },
                {
                  label: 'ساعات الإرسال',
                  value: `${settings.antiSpam.sendFrom} - ${settings.antiSpam.sendTo}`,
                },
                { label: 'اسم البوت', value: settings.platform.botName },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{item.label}</span>
                  <span className="font-semibold text-slate-700 text-left" dir="ltr">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Save Button (sticky on mobile) */}
          <div className="sticky bottom-4">
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="btn-primary w-full justify-center text-sm"
            >
              {saved ? (
                <>
                  <CheckCircle size={15} />
                  تم الحفظ
                </>
              ) : (
                <>
                  <Save size={15} />
                  {saving ? 'جاري الحفظ...' : 'حفظ جميع الإعدادات'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
