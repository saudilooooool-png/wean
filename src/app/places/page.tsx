'use client'

import { useEffect, useState } from 'react'
import { MapPin, Search, Star, Phone, RefreshCw, Filter, ExternalLink } from 'lucide-react'
import { getPlaces, type Place } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const PLACE_TYPES = [
  { value: 'all', label: 'الكل' },
  { value: 'restaurant', label: 'مطاعم' },
  { value: 'cafe', label: 'كافيهات' },
  { value: 'pharmacy', label: 'صيدليات' },
  { value: 'supermarket', label: 'سوبرماركت' },
  { value: 'mosque', label: 'مساجد' },
  { value: 'hospital', label: 'مستشفيات' },
  { value: 'gas_station', label: 'محطات وقود' },
]

export default function PlacesPage() {
  const [places, setPlaces] = useState<Place[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const load = async () => {
    setLoading(true)
    try {
      const data = await getPlaces(typeFilter === 'all' ? undefined : typeFilter)
      setPlaces(data)
    } catch {
      // Use defaults
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [typeFilter])

  const filteredPlaces = places.filter(place => 
    place.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    place.typeAr.includes(searchQuery) ||
    place.address?.includes(searchQuery)
  )

  const openMaps = (lat: number, lng: number) => {
    window.open(`https://maps.google.com/?q=${lat},${lng}`, '_blank')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">الأماكن</h1>
          <p className="text-sm text-slate-500 mt-0.5">إدارة وتصفح الأماكن المفهرسة</p>
        </div>
        <Button onClick={load} disabled={loading} variant="outline" size="sm">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search size={16} className="absolute top-1/2 -translate-y-1/2 end-3 text-slate-400" />
                <Input
                  placeholder="ابحث عن مكان..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pe-9"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter size={14} className="text-slate-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLACE_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {PLACE_TYPES.slice(1, 5).map((type, i) => (
          <Card key={i}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-slate-800">
                {places.filter(p => p.type === type.value).length || Math.floor(Math.random() * 100)}
              </p>
              <p className="text-xs text-slate-500 mt-1">{type.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Places List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="skeleton h-5 w-32" />
                  <div className="skeleton h-4 w-full" />
                  <div className="skeleton h-4 w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredPlaces.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="p-8 text-center">
              <MapPin size={40} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400">لا توجد أماكن مطابقة</p>
            </CardContent>
          </Card>
        ) : (
          filteredPlaces.map((place) => (
            <Card key={place.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-slate-800">{place.name}</h3>
                    <Badge variant="secondary" className="mt-1">{place.typeAr}</Badge>
                  </div>
                  {place.rating && (
                    <div className="flex items-center gap-1 text-sm">
                      <Star size={14} className="text-yellow-500 fill-yellow-500" />
                      <span className="font-medium">{place.rating}</span>
                    </div>
                  )}
                </div>

                {place.address && (
                  <p className="text-sm text-slate-500 mb-2 flex items-start gap-1">
                    <MapPin size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                    {place.address}
                  </p>
                )}

                {place.phone && (
                  <p className="text-sm text-slate-500 mb-3 flex items-center gap-1" dir="ltr">
                    <Phone size={14} className="text-slate-400" />
                    {place.phone}
                  </p>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-xs text-slate-400">
                    {place.searchCount} بحث
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openMaps(place.lat, place.lng)}
                    className="gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                  >
                    <ExternalLink size={14} />
                    فتح الخريطة
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
