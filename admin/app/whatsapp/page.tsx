'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Wifi,
  WifiOff,
  RefreshCw,
  QrCode,
  Phone,
  CheckCircle,
  XCircle,
  X,
  Smartphone,
  Settings,
  Loader2,
  AlertCircle,
  Unlink,
  Power,
} from 'lucide-react'

interface WhatsAppStatus {
  connected: boolean
  number: string
  instanceName: string
  state: string
  qrUrl?: string
  lastConnected?: string
}

interface Settings {
  evolutionUrl: string
  evolutionApiKey: string
  evolutionInstance: string
  setupCompleted: boolean
}

export default function WhatsAppPage() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showQRModal, setShowQRModal] = useState(false)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [reconnecting, setReconnecting] = useState(false)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  // تحميل الإعدادات
  useEffect(() => {
    const savedSettings = localStorage.getItem('wean_settings')
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings))
    }
  }, [])

  // تحميل حالة WhatsApp
  const load = useCallback(async () => {
    if (!settings?.evolutionUrl || !settings?.evolutionApiKey) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `${settings.evolutionUrl}/instance/connectionState/${settings.evolutionInstance}`,
        {
          headers: {
            'apikey': settings.evolutionApiKey,
          },
        }
      )

      if (!response.ok) {
        throw new Error('فشل الاتصال بـ Evolution API')
      }

      const data = await response.json()
      const instance = data.instance || {}
      
      setStatus({
        connected: instance.state === 'open',
        number: instance.owner || '',
        instanceName: settings.evolutionInstance,
        state: instance.state || 'unknown',
        qrUrl: `${settings.evolutionUrl}/instance/qrcode/${settings.evolutionInstance}?image=true&apikey=${settings.evolutionApiKey}`,
        lastConnected: instance.state === 'open' ? new Date().toISOString() : undefined,
      })
    } catch (err) {
      setError('تعذّر جلب حالة واتساب. تأكد من تشغيل Evolution API.')
      setStatus({
        connected: false,
        number: '',
        instanceName: settings?.evolutionInstance || 'wean_bot',
        state: 'disconnected',
      })
    } finally {
      setLoading(false)
    }
  }, [settings])

  useEffect(() => {
    if (settings) {
      load()
      const interval = setInterval(load, 10000)
      return () => clearInterval(interval)
    }
  }, [settings, load])

  // إنشاء instance جديد
  const createInstance = async () => {
    if (!settings?.evolutionUrl || !settings?.evolutionApiKey) return

    setReconnecting(true)
    try {
      await fetch(`${settings.evolutionUrl}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': settings.evolutionApiKey,
        },
        body: JSON.stringify({
          instanceName: settings.evolutionInstance,
          qrcode: true,
        }),
      })
      await load()
    } catch (err) {
      setError('فشل إنشاء Instance')
    } finally {
      setReconnecting(false)
    }
  }

  // ربط Instance
  const connectInstance = async () => {
    if (!settings?.evolutionUrl || !settings?.evolutionApiKey) return

    try {
      await fetch(`${settings.evolutionUrl}/instance/connect/${settings.evolutionInstance}`, {
        headers: {
          'apikey': settings.evolutionApiKey,
        },
      })
    } catch (err) {
      // تجاهل الخطأ
    }
  }

  // فصل Instance
  const disconnectInstance = async () => {
    if (!settings?.evolutionUrl || !settings?.evolutionApiKey) return

    setReconnecting(true)
    try {
      await fetch(`${settings.evolutionUrl}/instance/logout/${settings.evolutionInstance}`, {
        method: 'DELETE',
        headers: {
          'apikey': settings.evolutionApiKey,
        },
      })
      await load()
    } catch (err) {
      setError('فشل قطع الاتصال')
    } finally {
      setReconnecting(false)
    }
  }

  // فتح نافذة QR
  const openQR = async () => {
    setShowQRModal(true)
    setQrLoading(true)
    setQrUrl(null)

    try {
      await connectInstance()
      
      if (settings?.evolutionUrl && settings?.evolutionApiKey) {
        setQrUrl(`${settings.evolutionUrl}/instance/qrcode/${settings.evolutionInstance}?image=true&apikey=${settings.evolutionApiKey}`)
      }
    } catch (err) {
      setError('فشل جلب QR Code')
    } finally {
      setQrLoading(false)
    }
  }

  // تحديث الإعدادات
  const updateSettings = (newSettings: Partial<Settings>) => {
    const updated = { ...settings, ...newSettings } as Settings
    localStorage.setItem('wean_settings', JSON.stringify(updated))
    setSettings(updated)
    setShowSettings(false)
    load()
  }

  // إذا لم تكن الإعدادات موجودة
  if (!settings || !settings.setupCompleted) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-4">
          <AlertCircle size={40} className="text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">لم يتم إعداد النظام</h2>
        <p className="text-slate-500 mb-6 text-center max-w-md">
          يرجى إكمال الإعداد الأولي للنظام للتمكن من استخدام WhatsApp
        </p>
        <a
          href="/setup"
          className="btn-primary"
        >
          <Settings size={16} />
          الانتقال للإعداد
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">إدارة واتساب</h1>
          <p className="text-sm text-slate-500 mt-0.5">حالة الاتصال والرقم المرتبط</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="btn-secondary text-sm"
          >
            <Settings size={15} />
            الإعدادات
          </button>
          <button onClick={load} disabled={loading} className="btn-secondary text-sm">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            تحديث
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
          <p className="text-red-600 text-sm font-medium">{error}</p>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-700">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Connection Card */}
        <div className="admin-card p-6 lg:col-span-2">
          <h2 className="text-base font-bold text-slate-800 mb-5">حالة الاتصال</h2>

          {loading ? (
            <div className="space-y-4">
              <div className="skeleton h-20 w-full rounded-xl" />
              <div className="skeleton h-12 w-48" />
            </div>
          ) : (
            <>
              {/* Status Banner */}
              <div
                className={`flex items-center gap-4 p-5 rounded-xl mb-6 ${
                  status?.connected
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${
                    status?.connected ? 'bg-green-100' : 'bg-red-100'
                  }`}
                >
                  {status?.connected ? (
                    <Wifi size={28} className="text-green-600" />
                  ) : (
                    <WifiOff size={28} className="text-red-500" />
                  )}
                </div>
                <div className="flex-1">
                  <p
                    className={`text-xl font-bold ${
                      status?.connected ? 'text-green-700' : 'text-red-600'
                    }`}
                  >
                    {status?.connected ? 'متصل' : 'غير متصل'}
                  </p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {status?.connected
                      ? `الرقم: ${status.number}`
                      : `الحالة: ${status?.state || 'غير معروف'}`}
                  </p>
                </div>
                {status?.connected && (
                  <span className="status-dot connected flex-shrink-0" />
                )}
              </div>

              {/* Number Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Phone size={15} className="text-slate-400" />
                    <span className="text-xs text-slate-500 font-medium">الرقم المرتبط</span>
                  </div>
                  <p className="text-lg font-bold text-slate-800 font-mono" dir="ltr">
                    {status?.number || '—'}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Smartphone size={15} className="text-slate-400" />
                    <span className="text-xs text-slate-500 font-medium">اسم الجلسة</span>
                  </div>
                  <p className="text-lg font-bold text-slate-800 font-mono">
                    {status?.instanceName || '—'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                {!status?.connected ? (
                  <>
                    <button onClick={openQR} className="btn-primary">
                      <QrCode size={16} />
                      ربط بـ QR Code
                    </button>
                    <button
                      onClick={createInstance}
                      disabled={reconnecting}
                      className="btn-secondary"
                    >
                      {reconnecting ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Power size={16} />
                      )}
                      إنشاء Instance جديد
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={disconnectInstance}
                      disabled={reconnecting}
                      className="btn-danger"
                    >
                      <Unlink size={16} />
                      فصل الاتصال
                    </button>
                    <button
                      onClick={openQR}
                      className="btn-secondary"
                    >
                      <QrCode size={16} />
                      تغيير الرقم
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Info Panel */}
        <div className="admin-card p-6">
          <h2 className="text-base font-bold text-slate-800 mb-4">معلومات الاتصال</h2>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'خادم Evolution', value: settings?.evolutionUrl?.replace('http://', '').replace('https://', '') || '—' },
                { label: 'اسم Instance', value: settings?.evolutionInstance || '—' },
                { label: 'حالة الاتصال', value: status?.connected ? 'نشط ✓' : 'غير متصل' },
                { label: 'آخر تحديث', value: new Date().toLocaleTimeString('ar-SA') },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"
                >
                  <span className="text-sm text-slate-600">{item.label}</span>
                  <span className="text-sm font-bold text-slate-800">{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="admin-card p-6">
        <h2 className="text-base font-bold text-slate-800 mb-4">كيفية الربط</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-green-600 font-bold mb-3">1</div>
            <h3 className="font-semibold text-slate-700 mb-1">تشغيل Evolution API</h3>
            <p className="text-sm text-slate-500">تأكد من تشغيل الخدمة عبر Docker</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-green-600 font-bold mb-3">2</div>
            <h3 className="font-semibold text-slate-700 mb-1">مسح QR Code</h3>
            <p className="text-sm text-slate-500">افتح WhatsApp على هاتفك وامسح الكود</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-green-600 font-bold mb-3">3</div>
            <h3 className="font-semibold text-slate-700 mb-1">جاهز للاستخدام</h3>
            <p className="text-sm text-slate-500">البوت متصل وجاهز لاستقبال الرسائل</p>
          </div>
        </div>
      </div>

      {/* QR Modal */}
      {showQRModal && (
        <div className="modal-overlay" onClick={() => setShowQRModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">مسح رمز QR</h3>
              <button
                onClick={() => setShowQRModal(false)}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <div className="p-6 text-center">
              {qrLoading ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <Loader2 size={40} className="animate-spin text-green-500 mb-4" />
                  <p className="text-slate-500">جاري إنشاء QR Code...</p>
                </div>
              ) : qrUrl ? (
                <div>
                  <img
                    src={qrUrl}
                    alt="QR Code"
                    className="w-64 h-64 mx-auto mb-4 rounded-xl border border-slate-100"
                  />
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                    <p className="text-sm text-green-700 font-medium mb-2">
                      خطوات المسح:
                    </p>
                    <ol className="text-sm text-green-600 text-right space-y-1">
                      <li>1. افتح WhatsApp على هاتفك</li>
                      <li>2. اضغط على القائمة (ثلاث نقاط)</li>
                      <li>3. اختر "الأجهزة المرتبطة"</li>
                      <li>4. اضغط "ربط جهاز" وامسح الكود</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64">
                  <AlertCircle size={40} className="text-red-400 mb-4" />
                  <p className="text-slate-500">فشل جلب QR Code</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-center gap-3">
              <button
                onClick={() => setShowQRModal(false)}
                className="btn-secondary text-sm"
              >
                إغلاق
              </button>
              <button
                onClick={openQR}
                className="btn-primary text-sm"
              >
                <RefreshCw size={14} />
                تحديث QR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">إعدادات Evolution API</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <SettingsForm
              settings={settings}
              onSave={updateSettings}
              onCancel={() => setShowSettings(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// مكون نموذج الإعدادات
function SettingsForm({
  settings,
  onSave,
  onCancel,
}: {
  settings: Settings
  onSave: (settings: Partial<Settings>) => void
  onCancel: () => void
}) {
  const [evolutionUrl, setEvolutionUrl] = useState(settings.evolutionUrl || '')
  const [evolutionApiKey, setEvolutionApiKey] = useState(settings.evolutionApiKey || '')
  const [evolutionInstance, setEvolutionInstance] = useState(settings.evolutionInstance || '')

  const handleSave = () => {
    onSave({
      evolutionUrl,
      evolutionApiKey,
      evolutionInstance,
    })
  }

  return (
    <div className="p-5 space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-2">
          رابط الخادم
        </label>
        <input
          type="url"
          value={evolutionUrl}
          onChange={(e) => setEvolutionUrl(e.target.value)}
          placeholder="http://localhost:8080"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-2">
          مفتاح API
        </label>
        <input
          type="password"
          value={evolutionApiKey}
          onChange={(e) => setEvolutionApiKey(e.target.value)}
          placeholder="API Key"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
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
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
        />
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <button onClick={onCancel} className="btn-secondary text-sm">
          إلغاء
        </button>
        <button onClick={handleSave} className="btn-primary text-sm">
          حفظ
        </button>
      </div>
    </div>
  )
}
