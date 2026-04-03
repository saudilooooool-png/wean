'use client'

import { useState, useEffect } from 'react'
import { Search, MapPin, Star, Filter, RefreshCw, Eye, Edit3, Trash2, MoreVertical, Plus } from 'lucide-react'

interface Place {
  id: string
  name: string
  category: string
  city: string
  rating: number
  reviews: number
  searches: number
  status: 'active' | 'inactive' | 'pending'
  image?: string
}

const mockPlaces: Place[] = [
  { id: '1', name: 'مطعم البيك', category: 'مطاعم', city: 'جدة', rating: 4.8, reviews: 12500, searches: 3500, status: 'active' },
  { id: '2', name: 'كافيه بودريوم', category: 'مقاهي', city: 'الرياض', rating: 4.5, reviews: 3200, searches: 2100, status: 'active' },
  { id: '3', name: 'حديقة الملك عبدالله', category: 'حدائق', city: 'جدة', rating: 4.7, reviews: 8900, searches: 1800, status: 'active' },
  { id: '4', name: 'مول الرياض', category: 'تسوق', city: 'الرياض', rating: 4.4, reviews: 15000, searches: 4500, status: 'active' },
  { id: '5', name: 'شاطئ نصف القمر', category: 'شواطئ', city: 'الخبر', rating: 4.3, reviews: 4500, searches: 1200, status: 'inactive' },
  { id: '6', name: 'مطعم السلطان', category: 'مطاعم', city: 'الدمام', rating: 4.2, reviews: 2100, searches: 980, status: 'pending' },
  { id: '7', name: 'متحف المصمك', category: 'معالم سياحية', city: 'الرياض', rating: 4.9, reviews: 6700, searches: 2200, status: 'active' },
  { id: '8', name: 'منتزه البحيرة', category: 'حدائق', city: 'الخبر', rating: 4.1, reviews: 1800, searches: 650, status: 'active' },
]

const categories = ['الكل', 'مطاعم', 'مقاهي', 'حدائق', 'تسوق', 'شواطئ', 'معالم سياحية']
const cities = ['الكل', 'الرياض', 'جدة', 'الخبر', 'الدمام', 'مكة', 'المدينة']
const statuses = ['الكل', 'نشط', 'موقوف', 'قيد المراجعة']

export default function PlacesPage() {
  const [places, setPlaces] = useState<Place[]>(mockPlaces)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('الكل')
  const [selectedCity, setSelectedCity] = useState('الكل')
  const [selectedStatus, setSelectedStatus] = useState('الكل')
  const [showFilters, setShowFilters] = useState(false)

  const loadPlaces = async () => {
    setLoading(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500))
    setPlaces(mockPlaces)
    setLoading(false)
  }

  useEffect(() => {
    loadPlaces()
  }, [])

  const filteredPlaces = places.filter(place => {
    const matchesSearch = place.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'الكل' || place.category === selectedCategory
    const matchesCity = selectedCity === 'الكل' || place.city === selectedCity
    const matchesStatus = selectedStatus === 'الكل' || 
      (selectedStatus === 'نشط' && place.status === 'active') ||
      (selectedStatus === 'موقوف' && place.status === 'inactive') ||
      (selectedStatus === 'قيد المراجعة' && place.status === 'pending')
    return matchesSearch && matchesCategory && matchesCity && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">نشط</span>
      case 'inactive':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">موقوف</span>
      case 'pending':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">قيد المراجعة</span>
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">إدارة الأماكن</h1>
          <p className="text-sm text-slate-500 mt-0.5">إدارة وتنظيم الأماكن المتاحة للبحث</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadPlaces}
            disabled={loading}
            className="btn-secondary text-sm"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            تحديث
          </button>
          <button className="btn-primary text-sm">
            <Plus size={15} />
            إضافة مكان
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="admin-card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="البحث عن مكان..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition-all text-sm"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary text-sm ${showFilters ? 'bg-green-50 border-green-200 text-green-700' : ''}`}
          >
            <Filter size={15} />
            الفلترة
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">التصنيف</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition-all text-sm"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* City */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">المدينة</label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition-all text-sm"
              >
                {cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">الحالة</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition-all text-sm"
              >
                {statuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="admin-card p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{places.length}</p>
          <p className="text-xs text-slate-500 mt-1">إجمالي الأماكن</p>
        </div>
        <div className="admin-card p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{places.filter(p => p.status === 'active').length}</p>
          <p className="text-xs text-slate-500 mt-1">نشط</p>
        </div>
        <div className="admin-card p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{places.filter(p => p.status === 'inactive').length}</p>
          <p className="text-xs text-slate-500 mt-1">موقوف</p>
        </div>
        <div className="admin-card p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{places.filter(p => p.status === 'pending').length}</p>
          <p className="text-xs text-slate-500 mt-1">قيد المراجعة</p>
        </div>
      </div>

      {/* Places Table */}
      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500">المكان</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500">التصنيف</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500">المدينة</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500">التقييم</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500">عمليات البحث</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500">الحالة</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="py-3 px-4"><div className="skeleton h-4 w-24" /></td>
                    <td className="py-3 px-4"><div className="skeleton h-4 w-16" /></td>
                    <td className="py-3 px-4"><div className="skeleton h-4 w-16" /></td>
                    <td className="py-3 px-4"><div className="skeleton h-4 w-12" /></td>
                    <td className="py-3 px-4"><div className="skeleton h-4 w-12" /></td>
                    <td className="py-3 px-4"><div className="skeleton h-4 w-16" /></td>
                    <td className="py-3 px-4"><div className="skeleton h-4 w-20" /></td>
                  </tr>
                ))
              ) : filteredPlaces.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    لا توجد أماكن مطابقة للبحث
                  </td>
                </tr>
              ) : (
                filteredPlaces.map((place) => (
                  <tr key={place.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold text-sm">
                          {place.name.charAt(0)}
                        </div>
                        <span className="font-medium text-slate-700">{place.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-slate-600">{place.category}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-sm text-slate-600">
                        <MapPin size={14} className="text-slate-400" />
                        {place.city}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Star size={14} className="text-yellow-500 fill-yellow-500" />
                        <span className="text-sm font-medium text-slate-700">{place.rating}</span>
                        <span className="text-xs text-slate-400">({place.reviews.toLocaleString()})</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm font-medium text-slate-700">{place.searches.toLocaleString()}</span>
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(place.status)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                          <Eye size={16} />
                        </button>
                        <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-green-600 transition-colors">
                          <Edit3 size={16} />
                        </button>
                        <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-red-600 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
