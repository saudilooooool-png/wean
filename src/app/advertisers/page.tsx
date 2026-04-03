'use client'

import { useEffect, useState } from 'react'
import { Store, CheckCircle, XCircle, Clock, RefreshCw, Phone, Mail, Calendar, Pause, Play, MoreVertical } from 'lucide-react'
import { getAdvertisers, approveAdvertiser, rejectAdvertiser, type Advertiser } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function AdvertisersPage() {
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAdvertiser, setSelectedAdvertiser] = useState<Advertiser | null>(null)
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [processing, setProcessing] = useState(false)

  // Approval form
  const [durationDays, setDurationDays] = useState(30)
  const [maxSends, setMaxSends] = useState(50)
  const [serviceFee, setServiceFee] = useState(200)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getAdvertisers()
      setAdvertisers(data)
    } catch {
      setError('تعذّر تحميل المعلنين.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleApprove = async () => {
    if (!selectedAdvertiser) return
    setProcessing(true)
    try {
      await approveAdvertiser(selectedAdvertiser.id, {
        durationDays,
        maxSendsPerWeek: maxSends,
        serviceFee,
      })
      setShowApproveDialog(false)
      setSelectedAdvertiser(null)
      load()
    } catch {
      // Handle error
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async (id: string) => {
    setProcessing(true)
    try {
      await rejectAdvertiser(id)
      load()
    } catch {
      // Handle error
    } finally {
      setProcessing(false)
    }
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

  const stats = {
    total: advertisers.length,
    pending: advertisers.filter(a => a.status === 'pending').length,
    active: advertisers.filter(a => a.status === 'active').length,
    rejected: advertisers.filter(a => a.status === 'rejected').length,
  }

  const pendingAdvertisers = advertisers.filter(a => a.status === 'pending')
  const activeAdvertisers = advertisers.filter(a => a.status === 'active')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">إدارة المعلنين</h1>
          <p className="text-sm text-slate-500 mt-0.5">طلبات الاشتراك والحملات الإعلانية</p>
        </div>
        <Button onClick={load} disabled={loading} variant="outline" size="sm">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
            <p className="text-xs text-slate-500 mt-1">إجمالي المعلنين</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
            <p className="text-xs text-slate-500 mt-1">طلبات معلقة</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            <p className="text-xs text-slate-500 mt-1">نشطون</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            <p className="text-xs text-slate-500 mt-1">مرفوضون</p>
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

      {/* Pending Requests */}
      {pendingAdvertisers.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Clock size={18} className="text-orange-500" />
            طلبات معلقة ({pendingAdvertisers.length})
          </h2>
          <div className="space-y-4">
            {pendingAdvertisers.map((advertiser) => (
              <Card key={advertiser.id} className="border-orange-200 bg-orange-50/50">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold">
                        {advertiser.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800">{advertiser.name}</h3>
                        <p className="text-sm text-slate-500">{advertiser.category} • {advertiser.region}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                          {advertiser.contactPhone && (
                            <span className="flex items-center gap-1">
                              <Phone size={12} />
                              {advertiser.contactPhone}
                            </span>
                          )}
                          {advertiser.contactEmail && (
                            <span className="flex items-center gap-1">
                              <Mail size={12} />
                              {advertiser.contactEmail}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 mt-2">
                          الميزانية: <span className="font-bold text-green-600">{advertiser.budget} ريال</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setSelectedAdvertiser(advertiser)
                          setShowApproveDialog(true)
                        }}
                        className="bg-green-600 hover:bg-green-700 gap-1"
                        size="sm"
                      >
                        <CheckCircle size={14} />
                        قبول
                      </Button>
                      <Button
                        onClick={() => handleReject(advertiser.id)}
                        variant="destructive"
                        size="sm"
                        className="gap-1"
                      >
                        <XCircle size={14} />
                        رفض
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Active Advertisers */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Store size={18} className="text-green-500" />
          المعلنين النشطين ({activeAdvertisers.length})
        </h2>
        <div className="space-y-4">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <div className="skeleton h-16 w-full" />
                </CardContent>
              </Card>
            ))
          ) : activeAdvertisers.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Store size={40} className="text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400">لا يوجد معلنين نشطين</p>
              </CardContent>
            </Card>
          ) : (
            activeAdvertisers.map((advertiser) => (
              <Card key={advertiser.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold">
                        {advertiser.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-800">{advertiser.name}</h3>
                          <Badge variant={advertiser.campaignStatus === 'active' ? 'default' : 'secondary'} className={advertiser.campaignStatus === 'active' ? 'bg-green-100 text-green-700' : ''}>
                            {advertiser.campaignStatus === 'active' ? 'نشط' : advertiser.campaignStatus === 'paused' ? 'متوقف' : 'منتهي'}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-500">{advertiser.category} • {advertiser.region}</p>
                        <div className="flex items-center gap-4 mt-3 text-xs">
                          <span className="text-slate-500">
                            <span className="font-medium text-slate-700">{advertiser.maxSendsPerWeek}</span> رسالة/أسبوع
                          </span>
                          <span className="text-slate-500">
                            الرسوم: <span className="font-medium text-green-600">{advertiser.serviceFee} ريال</span>
                          </span>
                          {advertiser.subscriptionEnds && (
                            <span className="text-slate-500 flex items-center gap-1">
                              <Calendar size={12} />
                              ينتهي: {formatDate(advertiser.subscriptionEnds)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {advertiser.campaignStatus === 'active' ? (
                        <Button variant="outline" size="sm" className="gap-1">
                          <Pause size={14} />
                          إيقاف
                        </Button>
                      ) : advertiser.campaignStatus === 'paused' ? (
                        <Button className="bg-green-600 hover:bg-green-700 gap-1" size="sm">
                          <Play size={14} />
                          تفعيل
                        </Button>
                      ) : null}
                      <Button variant="outline" size="sm">
                        <MoreVertical size={14} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>قبول المعلن</DialogTitle>
            <DialogDescription>
              أدخل تفاصيل اشتراك {selectedAdvertiser?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>مدة الاشتراك (أيام)</Label>
              <Input
                type="number"
                value={durationDays}
                onChange={(e) => setDurationDays(parseInt(e.target.value))}
              />
            </div>
            <div>
              <Label>الحد الأقصى للرسائل/أسبوع</Label>
              <Input
                type="number"
                value={maxSends}
                onChange={(e) => setMaxSends(parseInt(e.target.value))}
              />
            </div>
            <div>
              <Label>رسوم الخدمة (ريال)</Label>
              <Input
                type="number"
                value={serviceFee}
                onChange={(e) => setServiceFee(parseInt(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              إلغاء
            </Button>
            <Button onClick={handleApprove} disabled={processing} className="bg-green-600 hover:bg-green-700">
              {processing ? 'جاري...' : 'تأكيد القبول'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
