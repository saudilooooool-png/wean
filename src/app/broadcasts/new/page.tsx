'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Send, Users, MapPin, Clock, Calendar, AlertCircle, ArrowRight, Eye } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

const broadcastSchema = z.object({
  name: z.string().min(1, 'اسم الحملة مطلوب'),
  message: z.string().min(1, 'نص الرسالة مطلوب').max(1000, 'الرسالة طويلة جداً'),
  audienceType: z.enum(['all', 'search_type', 'region']),
  searchType: z.string().optional(),
  region: z.string().optional(),
  withinDays: z.number().min(1).max(90).optional(),
  schedule: z.enum(['now', 'later']),
  scheduledDate: z.string().optional(),
  scheduledTime: z.string().optional(),
})

type BroadcastForm = z.infer<typeof broadcastSchema>

export default function NewBroadcastPage() {
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(false)
  const [estimatedCount, setEstimatedCount] = useState(0)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BroadcastForm>({
    resolver: zodResolver(broadcastSchema),
    defaultValues: {
      name: '',
      message: '',
      audienceType: 'all',
      schedule: 'now',
    },
  })

  const audienceType = watch('audienceType')
  const schedule = watch('schedule')
  const message = watch('message')

  // Simulate audience count
  useEffect(() => {
    const counts: Record<string, number> = {
      all: 4827,
      search_type: 1247,
      region: 987,
    }
    setEstimatedCount(counts[audienceType] || 0)
  }, [audienceType])

  const onSubmit = async (data: BroadcastForm) => {
    setLoading(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))
    setLoading(false)
    // Redirect to broadcasts list
    window.location.href = '/broadcasts'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/broadcasts">
            <Button variant="ghost" size="icon">
              <ArrowRight size={20} />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">حملة جديدة</h1>
            <p className="text-sm text-slate-500 mt-0.5">إنشاء حملة رسائل جماعية</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold">معلومات الحملة</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">اسم الحملة</Label>
                  <Input
                    id="name"
                    placeholder="مثال: عروض رمضان"
                    {...register('name')}
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && (
                    <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Target Audience */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Users size={16} className="text-slate-400" />
                  الجمهور المستهدف
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>نوع الجمهور</Label>
                  <Select
                    value={audienceType}
                    onValueChange={(v) => setValue('audienceType', v as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع المستخدمين</SelectItem>
                      <SelectItem value="search_type">حسب نوع البحث</SelectItem>
                      <SelectItem value="region">حسب المنطقة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {audienceType === 'search_type' && (
                  <div>
                    <Label>نوع المكان</Label>
                    <Select onValueChange={(v) => setValue('searchType', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر نوع المكان" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="restaurant">مطعم</SelectItem>
                        <SelectItem value="cafe">كافيه</SelectItem>
                        <SelectItem value="pharmacy">صيدلية</SelectItem>
                        <SelectItem value="supermarket">سوبرماركت</SelectItem>
                        <SelectItem value="mosque">مسجد</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {audienceType === 'region' && (
                  <div>
                    <Label>المنطقة</Label>
                    <Select onValueChange={(v) => setValue('region', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر المنطقة" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="riyadh">الرياض</SelectItem>
                        <SelectItem value="jeddah">جدة</SelectItem>
                        <SelectItem value="makkah">مكة</SelectItem>
                        <SelectItem value="madinah">المدينة</SelectItem>
                        <SelectItem value="dammam">الدمام</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label>البحث عن مستخدمين نشطين في آخر</Label>
                  <Select onValueChange={(v) => setValue('withinDays', parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الفترة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 أيام</SelectItem>
                      <SelectItem value="14">14 يوم</SelectItem>
                      <SelectItem value="30">30 يوم</SelectItem>
                      <SelectItem value="90">90 يوم</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Message */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Send size={16} className="text-slate-400" />
                  نص الرسالة
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Textarea
                    placeholder="اكتب نص الرسالة هنا..."
                    rows={5}
                    {...register('message')}
                    className={errors.message ? 'border-red-500' : ''}
                  />
                  {errors.message && (
                    <p className="text-red-500 text-xs mt-1">{errors.message.message}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    {message?.length || 0} / 1000 حرف
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Schedule */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Clock size={16} className="text-slate-400" />
                  الجدولة
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant={schedule === 'now' ? 'default' : 'outline'}
                    className={schedule === 'now' ? 'bg-green-600 hover:bg-green-700' : ''}
                    onClick={() => setValue('schedule', 'now')}
                  >
                    إرسال الآن
                  </Button>
                  <Button
                    type="button"
                    variant={schedule === 'later' ? 'default' : 'outline'}
                    className={schedule === 'later' ? 'bg-green-600 hover:bg-green-700' : ''}
                    onClick={() => setValue('schedule', 'later')}
                  >
                    جدولة لاحقاً
                  </Button>
                </div>

                {schedule === 'later' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>التاريخ</Label>
                      <Input type="date" {...register('scheduledDate')} />
                    </div>
                    <div>
                      <Label>الوقت</Label>
                      <Input type="time" {...register('scheduledTime')} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPreview(!preview)}
                className="gap-2"
              >
                <Eye size={16} />
                معاينة
              </Button>
              <div className="flex gap-2">
                <Link href="/broadcasts">
                  <Button variant="outline">إلغاء</Button>
                </Link>
                <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700 gap-2">
                  {loading ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      جاري الإنشاء...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      {schedule === 'now' ? 'إرسال الآن' : 'جدولة'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold">ملخص الحملة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-slate-800">{estimatedCount.toLocaleString('ar-SA')}</p>
                <p className="text-sm text-slate-500 mt-1">مستخدم سيستلم الرسالة</p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">الجمهور</span>
                  <Badge variant="secondary">
                    {audienceType === 'all' ? 'الكل' : audienceType === 'search_type' ? 'حسب البحث' : 'حسب المنطقة'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">التوقيت</span>
                  <Badge variant="secondary">
                    {schedule === 'now' ? 'فوري' : 'مجدول'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* WhatsApp Preview */}
          {preview && message && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold">معاينة واتساب</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-[#e5ddd5] rounded-xl p-3 space-y-2">
                  <div className="bg-[#dcf8c6] rounded-lg p-3 max-w-[85%] mr-auto">
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{message}</p>
                    <p className="text-[10px] text-slate-500 text-left mt-1">
                      {new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tips */}
          <Card className="bg-blue-50 border-blue-100">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <AlertCircle size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-800">نصائح للحملات</p>
                  <ul className="text-xs text-blue-700 mt-2 space-y-1">
                    <li>• اجعل الرسالة قصيرة ومباشرة</li>
                    <li>• استخدم الرموز التعبيرية بشكل معتدل</li>
                    <li>• أضف دعوة للتفاعل في النهاية</li>
                    <li>• لا ترسل أكثر من 3 رسائل أسبوعياً</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
