'use client'

import { useEffect, useState } from 'react'
import { Save, RefreshCw, MapPin, MessageSquare, Shield, Settings as SettingsIcon } from 'lucide-react'
import { getSettings, saveSettings, type AppSettings } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { toast } from 'sonner'

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await getSettings()
      setSettings(data)
    } catch {
      // Use defaults
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    try {
      await saveSettings(settings)
      toast.success('تم حفظ الإعدادات بنجاح')
    } catch {
      toast.error('فشل حفظ الإعدادات')
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (path: string, value: any) => {
    if (!settings) return
    const keys = path.split('.')
    const newSettings = { ...settings }
    let current: any = newSettings
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]]
    }
    current[keys[keys.length - 1]] = value
    setSettings(newSettings)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48" />
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-10 w-full" />
                <div className="skeleton h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!settings) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">الإعدادات</h1>
          <p className="text-sm text-slate-500 mt-0.5">إعدادات المنصة والبوت</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={load} disabled={loading} variant="outline" size="sm">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700 gap-2">
            <Save size={16} />
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Search Settings */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <MapPin size={16} className="text-slate-400" />
              إعدادات البحث
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>نطاق البحث الافتراضي</Label>
                <span className="text-sm font-medium text-slate-700">{settings.search.radius} متر</span>
              </div>
              <Slider
                value={[settings.search.radius]}
                onValueChange={([v]) => updateSetting('search.radius', v)}
                min={500}
                max={10000}
                step={500}
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>500م</span>
                <span>10كم</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>الحد الأقصى للنتائج</Label>
                <span className="text-sm font-medium text-slate-700">{settings.search.maxResults} نتائج</span>
              </div>
              <Slider
                value={[settings.search.maxResults]}
                onValueChange={([v]) => updateSetting('search.maxResults', v)}
                min={1}
                max={10}
                step={1}
              />
            </div>
          </CardContent>
        </Card>

        {/* Platform Settings */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <SettingsIcon size={16} className="text-slate-400" />
              إعدادات المنصة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>اسم البوت</Label>
              <Input
                value={settings.platform.botName}
                onChange={(e) => updateSetting('platform.botName', e.target.value)}
              />
            </div>
            <div>
              <Label>وصف المنصة</Label>
              <Textarea
                value={settings.platform.description}
                onChange={(e) => updateSetting('platform.description', e.target.value)}
                rows={2}
              />
            </div>
            <div>
              <Label>رقم الدعم</Label>
              <Input
                value={settings.platform.supportPhone}
                onChange={(e) => updateSetting('platform.supportPhone', e.target.value)}
                dir="ltr"
              />
            </div>
          </CardContent>
        </Card>

        {/* Bot Messages */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <MessageSquare size={16} className="text-slate-400" />
              رسائل البوت
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>رسالة الترحيب</Label>
              <Textarea
                value={settings.botMessages.welcome}
                onChange={(e) => updateSetting('botMessages.welcome', e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <Label>رسالة المطالبة بالموقع</Label>
              <Textarea
                value={settings.botMessages.prompt}
                onChange={(e) => updateSetting('botMessages.prompt', e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>رسالة &quot;لم يتم العثور&quot;</Label>
                <Textarea
                  value={settings.botMessages.notFound}
                  onChange={(e) => updateSetting('botMessages.notFound', e.target.value)}
                  rows={2}
                />
              </div>
              <div>
                <Label>رسالة الخطأ</Label>
                <Textarea
                  value={settings.botMessages.error}
                  onChange={(e) => updateSetting('botMessages.error', e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Anti-Spam */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Shield size={16} className="text-slate-400" />
              إعدادات مكافحة السپام
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>الحد الأقصى للرسائل/أسبوع</Label>
                <Input
                  type="number"
                  value={settings.antiSpam.maxPerWeek}
                  onChange={(e) => updateSetting('antiSpam.maxPerWeek', parseInt(e.target.value))}
                />
              </div>
              <div>
                <Label>وقت البدء</Label>
                <Input
                  type="time"
                  value={settings.antiSpam.sendFrom}
                  onChange={(e) => updateSetting('antiSpam.sendFrom', e.target.value)}
                />
              </div>
              <div>
                <Label>وقت الانتهاء</Label>
                <Input
                  type="time"
                  value={settings.antiSpam.sendTo}
                  onChange={(e) => updateSetting('antiSpam.sendTo', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
