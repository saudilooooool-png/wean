'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Settings,
  MessageSquare,
  Server,
  Key,
  Save,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  Database,
  Cpu,
} from 'lucide-react'

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [error, setError] = useState<string | null>(null)

  // إعدادات Evolution API
  const [evolutionUrl, setEvolutionUrl] = useState('http://localhost:8080')
  const [evolutionApiKey, setEvolutionApiKey] = useState('')
  const [evolutionInstance, setEvolutionInstance] = useState('wean_bot')

  // إعدادات قاعدة البيانات
  const [databaseUrl, setDatabaseUrl] = useState('')
  const [redisUrl, setRedisUrl] = useState('redis://localhost:6379')

  // إعدادات عامة
  const [botName, setBotName] = useState('وين أروح')
  const [adminEmail, setAdminEmail] = useState('')

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const response = await fetch(`${evolutionUrl}/instance/fetchInstances`, {
        headers: {
          'apikey': evolutionApiKey,
        },
      })
      if (response.ok) {
        setTestResult('success')
      } else {
        setTestResult('error')
      }
    } catch {
      setTestResult('error')
    } finally {
      setTesting(false)
    }
  }

  const saveSettings = async () => {
    setLoading(true)
    setError(null)
    try {
      // حفظ الإعدادات في localStorage
      const settings = {
        evolutionUrl,
        evolutionApiKey,
        evolutionInstance,
        databaseUrl,
        redisUrl,
        botName,
        adminEmail,
        setupCompleted: true,
        setupAt: new Date().toISOString(),
      }
      
      localStorage.setItem('wean_settings', JSON.stringify(settings))

      // الانتقال للصفحة الرئيسية
      router.push('/')
    } catch (err) {
      setError('حدث خطأ أثناء حفظ الإعدادات')
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    { num: 1, title: 'Evolution API', icon: MessageSquare },
    { num: 2, title: 'قاعدة البيانات', icon: Database },
    { num: 3, title: 'الإعدادات العامة', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-white font-bold text-3xl mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}
          >
            و
          </div>
          <h1 className="text-3xl font-bold text-slate-800">مرحباً بك في وين أروح</h1>
          <p className="text-slate-500 mt-2">إعداد المشروع لأول مرة</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  step >= s.num
                    ? 'bg-gradient-to-br from-green-500 to-green-600 text-white'
                    : 'bg-slate-200 text-slate-400'
                }`}
              >
                {step > s.num ? <CheckCircle size={20} /> : <s.icon size={20} />}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`w-12 h-1 mx-2 rounded transition-all ${
                    step > s.num ? 'bg-green-400' : 'bg-slate-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Step 1: Evolution API */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-green-100 rounded-xl">
                  <MessageSquare size={24} className="text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">إعداد WhatsApp</h2>
                  <p className="text-sm text-slate-500">أدخل بيانات Evolution API للاتصال بـ WhatsApp</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  <Server size={14} className="inline ml-1" />
                  رابط الخادم (Server URL)
                </label>
                <input
                  type="url"
                  value={evolutionUrl}
                  onChange={(e) => setEvolutionUrl(e.target.value)}
                  placeholder="http://localhost:8080"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  <Key size={14} className="inline ml-1" />
                  مفتاح API (API Key)
                </label>
                <input
                  type="password"
                  value={evolutionApiKey}
                  onChange={(e) => setEvolutionApiKey(e.target.value)}
                  placeholder="أدخل مفتاح API"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  اسم Instance
                </label>
                <input
                  type="text"
                  value={evolutionInstance}
                  onChange={(e) => setEvolutionInstance(e.target.value)}
                  placeholder="wean_bot"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition-all"
                />
              </div>

              {/* Test Connection */}
              <div className="flex items-center gap-4">
                <button
                  onClick={testConnection}
                  disabled={testing || !evolutionApiKey}
                  className="btn-secondary flex items-center gap-2"
                >
                  {testing ? <Loader2 size={16} className="animate-spin" /> : <Cpu size={16} />}
                  اختبار الاتصال
                </button>
                {testResult === 'success' && (
                  <span className="flex items-center gap-1 text-green-600 text-sm">
                    <CheckCircle size={16} /> تم الاتصال بنجاح
                  </span>
                )}
                {testResult === 'error' && (
                  <span className="flex items-center gap-1 text-red-600 text-sm">
                    <AlertCircle size={16} /> فشل الاتصال
                  </span>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-700">
                  <strong>ملاحظة:</strong> يمكنك تشغيل Evolution API عبر Docker:
                  <code className="block mt-2 bg-blue-100 p-2 rounded text-xs">
                    docker-compose up -d evolution-api
                  </code>
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Database */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-purple-100 rounded-xl">
                  <Database size={24} className="text-purple-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">قاعدة البيانات</h2>
                  <p className="text-sm text-slate-500">إعداد الاتصال بقاعدة البيانات (اختياري)</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  رابط قاعدة البيانات (PostgreSQL)
                </label>
                <input
                  type="text"
                  value={databaseUrl}
                  onChange={(e) => setDatabaseUrl(e.target.value)}
                  placeholder="postgresql://user:pass@localhost:5432/wean"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  رابط Redis
                </label>
                <input
                  type="text"
                  value={redisUrl}
                  onChange={(e) => setRedisUrl(e.target.value)}
                  placeholder="redis://localhost:6379"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition-all"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-amber-700">
                  <strong>توضيح:</strong> يمكن تخطي هذه الخطوة إذا كنت تستخدم الإعدادات الافتراضية.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: General Settings */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-orange-100 rounded-xl">
                  <Settings size={24} className="text-orange-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">الإعدادات العامة</h2>
                  <p className="text-sm text-slate-500">إعدادات البوت الأساسية</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  اسم البوت
                </label>
                <input
                  type="text"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  placeholder="وين أروح"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  بريد المدير
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition-all"
                />
              </div>

              {/* Summary */}
              <div className="bg-slate-50 rounded-xl p-4 mt-6">
                <h3 className="font-bold text-slate-700 mb-3">ملخص الإعدادات</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">خادم Evolution:</span>
                    <span className="text-slate-700">{evolutionUrl}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Instance:</span>
                    <span className="text-slate-700">{evolutionInstance}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">اسم البوت:</span>
                    <span className="text-slate-700">{botName}</span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-slate-100">
            <button
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="btn-secondary disabled:opacity-40"
            >
              <ArrowRight size={16} />
              السابق
            </button>

            {step < 3 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="btn-primary"
              >
                التالي
                <ArrowRight size={16} className="rotate-180" />
              </button>
            ) : (
              <button
                onClick={saveSettings}
                disabled={loading}
                className="btn-primary"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                حفظ الإعدادات
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-6">
          يمكنك تغيير هذه الإعدادات لاحقاً من صفحة الإعدادات
        </p>
      </div>
    </div>
  )
}
