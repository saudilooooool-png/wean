'use client'

import { useEffect, useState } from 'react'
import {
  Wifi,
  WifiOff,
  RefreshCw,
  QrCode,
  Clock,
  Phone,
  CheckCircle,
  XCircle,
  X,
  Smartphone,
  MessageSquare,
  Send,
} from 'lucide-react'
import { getWhatsAppStatus, reconnectWhatsApp, getQRCode, type WhatsAppStatus } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function WhatsAppPage() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showQRModal, setShowQRModal] = useState(false)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const [reconnectMsg, setReconnectMsg] = useState<string | null>(null)
  const [testPhone, setTestPhone] = useState('')
  const [testMessage, setTestMessage] = useState('')
  const [sendingTest, setSendingTest] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const s = await getWhatsAppStatus()
      setStatus(s)
    } catch {
      setError('تعذّر جلب حالة واتساب.')
    } finally {
      setLoading(false)
    }
  }

  const openQR = async () => {
    setShowQRModal(true)
    setQrLoading(true)
    try {
      const url = await getQRCode()
      setQrUrl(url)
    } catch {
      setQrUrl(null)
    } finally {
      setQrLoading(false)
    }
  }

  const handleReconnect = async () => {
    setReconnecting(true)
    setReconnectMsg(null)
    try {
      await reconnectWhatsApp()
      setReconnectMsg('تم إرسال طلب إعادة الاتصال بنجاح.')
      await load()
    } catch {
      setReconnectMsg('فشل إعادة الاتصال، يرجى المحاولة مجدداً.')
    } finally {
      setReconnecting(false)
    }
  }

  const sendTestMessage = async () => {
    if (!testPhone.trim() || !testMessage.trim()) return
    setSendingTest(true)
    // Simulate sending
    await new Promise(resolve => setTimeout(resolve, 1500))
    setSendingTest(false)
    setTestPhone('')
    setTestMessage('')
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (iso?: string) => {
    if (!iso) return '-'
    try {
      return new Date(iso).toLocaleString('ar-SA', {
        year: 'numeric',
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">إدارة واتساب</h1>
          <p className="text-sm text-slate-500 mt-0.5">حالة الاتصال والرقم المرتبط</p>
        </div>
        <Button onClick={load} disabled={loading} variant="outline" size="sm" className="gap-2">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          تحديث
        </Button>
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

      {/* Reconnect message */}
      {reconnectMsg && (
        <div
          className={`rounded-xl p-4 text-sm font-medium border ${
            reconnectMsg.includes('نجاح')
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-600'
          }`}
        >
          {reconnectMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Connection Card */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">حالة الاتصال</CardTitle>
          </CardHeader>
          <CardContent>
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
                  <div>
                    <p
                      className={`text-xl font-bold ${
                        status?.connected ? 'text-green-700' : 'text-red-600'
                      }`}
                    >
                      {status?.connected ? 'متصل' : 'غير متصل'}
                    </p>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {status?.connected
                        ? `آخر اتصال: ${formatTime(status?.lastConnected)}`
                        : 'يرجى إعادة الاتصال أو مسح رمز QR'}
                    </p>
                  </div>
                  <span
                    className={`status-dot me-auto flex-shrink-0 ${
                      status?.connected ? 'connected' : 'disconnected'
                    }`}
                  />
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
                  <Button onClick={openQR} className="bg-green-600 hover:bg-green-700 gap-2">
                    <QrCode size={16} />
                    تغيير الرقم / QR
                  </Button>
                  <Button
                    onClick={handleReconnect}
                    disabled={reconnecting}
                    variant="outline"
                    className="gap-2"
                  >
                    <RefreshCw size={16} className={reconnecting ? 'animate-spin' : ''} />
                    {reconnecting ? 'جاري الإعادة...' : 'إعادة الاتصال'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">إحصائيات سريعة</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="skeleton h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: 'الرسائل الواردة اليوم', value: '247' },
                  { label: 'الرسائل الصادرة اليوم', value: '312' },
                  { label: 'وقت الاستجابة', value: '< 1 ثانية' },
                  { label: 'معدل التسليم', value: '99.2%' },
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
          </CardContent>
        </Card>
      </div>

      {/* Test Message */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Send size={16} className="text-slate-400" />
            إرسال رسالة تجريبية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="رقم الهاتف (مع رمز الدولة)"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              dir="ltr"
            />
            <Input
              placeholder="نص الرسالة"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              className="md:col-span-1"
            />
            <Button 
              onClick={sendTestMessage} 
              disabled={sendingTest || !testPhone || !testMessage}
              className="bg-green-600 hover:bg-green-700 gap-2"
            >
              <Send size={16} />
              {sendingTest ? 'جاري الإرسال...' : 'إرسال'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Connection History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">سجل الاتصالات</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton w-8 h-8 rounded-full" />
                  <div className="flex-1">
                    <div className="skeleton h-3 w-32 mb-2" />
                    <div className="skeleton h-2.5 w-20" />
                  </div>
                  <div className="skeleton h-3 w-24" />
                </div>
              ))}
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute right-4 top-0 bottom-0 w-0.5 bg-slate-100" />

              <div className="space-y-4">
                {(status?.connectionHistory ?? []).map((event, i) => (
                  <div key={i} className="flex items-start gap-4 pe-10">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 relative z-10 ${
                        event.event === 'connected' || event.event === 'qr_scanned'
                          ? 'bg-green-100'
                          : 'bg-red-100'
                      }`}
                    >
                      {event.event === 'connected' || event.event === 'qr_scanned' ? (
                        <CheckCircle size={16} className="text-green-600" />
                      ) : (
                        <XCircle size={16} className="text-red-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-700">{event.description}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock size={11} className="text-slate-400" />
                        <span className="text-xs text-slate-400">{formatTime(event.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {(!status?.connectionHistory || status.connectionHistory.length === 0) && (
                  <p className="text-sm text-slate-400 text-center py-4">لا يوجد سجل اتصالات</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR Modal */}
      {showQRModal && (
        <div className="modal-overlay" onClick={() => setShowQRModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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
                <div className="w-48 h-48 mx-auto skeleton rounded-xl mb-4" />
              ) : qrUrl ? (
                <img
                  src={qrUrl}
                  alt="QR Code"
                  className="w-48 h-48 mx-auto mb-4 rounded-xl border border-slate-100"
                />
              ) : (
                <div className="w-48 h-48 mx-auto bg-slate-100 rounded-xl flex items-center justify-center mb-4">
                  <QrCode size={64} className="text-slate-300" />
                </div>
              )}
              <p className="text-sm text-slate-600 mb-2">
                افتح واتساب على هاتفك ← المزيد من الخيارات ← الأجهزة المرتبطة
              </p>
              <p className="text-xs text-slate-400">ثم اضغط &quot;ربط جهاز&quot; ومسح رمز QR أعلاه</p>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end">
              <Button onClick={() => setShowQRModal(false)} variant="outline" size="sm">
                إغلاق
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
