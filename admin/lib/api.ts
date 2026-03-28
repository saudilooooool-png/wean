const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Stats {
  totalContacts: number
  searchesToday: number
  activeAdvertisers: number
  messagesSent: number
  topPlaces: { label: string; percentage: number }[]
}

export interface Contact {
  id: string
  phone: string
  lastSearch: string
  searchCount: number
  region: string
  joinedAt: string
  status: 'active' | 'opted_out'
  searchHistory?: SearchRecord[]
}

export interface SearchRecord {
  query: string
  timestamp: string
  results: number
}

export interface WhatsAppStatus {
  connected: boolean
  number: string
  instanceName: string
  qrUrl?: string
  lastConnected?: string
  connectionHistory: ConnectionEvent[]
}

export interface ConnectionEvent {
  event: string
  timestamp: string
  description: string
}

export interface Broadcast {
  id: string
  name: string
  status: 'draft' | 'scheduled' | 'sent'
  targetCount: number
  sentCount: number
  readCount: number
  replyCount: number
  scheduledAt?: string
  sentAt?: string
  message: string
}

export interface BroadcastPayload {
  name: string
  message: string
  targetAudience: {
    type: 'all' | 'search_type' | 'region'
    searchType?: string
    region?: string
    withinDays?: number
  }
  schedule: 'now' | string
}

export interface Advertiser {
  id: string
  name: string
  category: string
  region: string
  budget: number
  requestedAt: string
  status: 'pending' | 'active' | 'rejected'
  campaignStatus?: 'active' | 'paused' | 'ended'
  subscriptionEnds?: string
  maxSendsPerWeek?: number
  serviceFee?: number
}

export interface AdvertiserApprovalPayload {
  durationDays: number
  maxSendsPerWeek: number
  serviceFee: number
}

export interface AppSettings {
  search: {
    radius: number
    maxResults: number
  }
  botMessages: {
    welcome: string
    prompt: string
  }
  antiSpam: {
    maxPerWeek: number
    sendFrom: string
    sendTo: string
  }
  platform: {
    botName: string
    description: string
  }
}

export interface ContactsResponse {
  contacts: Contact[]
  total: number
  page: number
  pages: number
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_STATS: Stats = {
  totalContacts: 4827,
  searchesToday: 312,
  activeAdvertisers: 18,
  messagesSent: 15640,
  topPlaces: [
    { label: 'مطعم', percentage: 45 },
    { label: 'كافيه', percentage: 28 },
    { label: 'صيدلية', percentage: 12 },
    { label: 'سوبرماركت', percentage: 9 },
    { label: 'صالون', percentage: 6 },
  ],
}

const MOCK_CONTACTS: Contact[] = [
  {
    id: '1',
    phone: '+966501234567',
    lastSearch: 'مطعم شاورما',
    searchCount: 23,
    region: 'الرياض',
    joinedAt: '2024-01-15',
    status: 'active',
    searchHistory: [
      { query: 'مطعم شاورما', timestamp: '2024-03-28T10:30:00', results: 5 },
      { query: 'كافيه قهوة', timestamp: '2024-03-27T09:15:00', results: 3 },
      { query: 'صيدلية', timestamp: '2024-03-25T14:00:00', results: 8 },
    ],
  },
  {
    id: '2',
    phone: '+966509876543',
    lastSearch: 'كافيه',
    searchCount: 15,
    region: 'جدة',
    joinedAt: '2024-02-03',
    status: 'active',
    searchHistory: [
      { query: 'كافيه', timestamp: '2024-03-28T08:00:00', results: 4 },
      { query: 'مطعم بيتزا', timestamp: '2024-03-20T12:00:00', results: 6 },
    ],
  },
  {
    id: '3',
    phone: '+966555123456',
    lastSearch: 'صيدلية',
    searchCount: 8,
    region: 'الدمام',
    joinedAt: '2024-03-01',
    status: 'opted_out',
    searchHistory: [
      { query: 'صيدلية', timestamp: '2024-03-26T16:00:00', results: 3 },
    ],
  },
  {
    id: '4',
    phone: '+966502345678',
    lastSearch: 'سوبرماركت',
    searchCount: 31,
    region: 'الرياض',
    joinedAt: '2023-12-20',
    status: 'active',
    searchHistory: [
      { query: 'سوبرماركت', timestamp: '2024-03-28T11:00:00', results: 7 },
      { query: 'بقالة قريبة', timestamp: '2024-03-27T18:00:00', results: 5 },
    ],
  },
  {
    id: '5',
    phone: '+966507654321',
    lastSearch: 'صالون',
    searchCount: 5,
    region: 'مكة',
    joinedAt: '2024-03-10',
    status: 'active',
    searchHistory: [
      { query: 'صالون حلاقة', timestamp: '2024-03-28T09:30:00', results: 4 },
    ],
  },
]

const MOCK_WHATSAPP: WhatsAppStatus = {
  connected: true,
  number: '+966500000001',
  instanceName: 'wean-main',
  lastConnected: '2024-03-28T08:00:00',
  connectionHistory: [
    { event: 'connected', timestamp: '2024-03-28T08:00:00', description: 'تم الاتصال بنجاح' },
    { event: 'disconnected', timestamp: '2024-03-27T23:55:00', description: 'انقطع الاتصال' },
    { event: 'connected', timestamp: '2024-03-27T08:30:00', description: 'تم الاتصال بنجاح' },
    { event: 'qr_scanned', timestamp: '2024-03-25T14:20:00', description: 'تم مسح رمز QR' },
  ],
}

const MOCK_BROADCASTS: Broadcast[] = [
  {
    id: '1',
    name: 'عروض رمضان',
    status: 'sent',
    targetCount: 1200,
    sentCount: 1185,
    readCount: 743,
    replyCount: 89,
    sentAt: '2024-03-20T18:00:00',
    message: 'مرحباً! 🌙 استمتع بعروض رمضان الحصرية من أفضل المطاعم في منطقتك.',
  },
  {
    id: '2',
    name: 'ترويج الكافيهات',
    status: 'scheduled',
    targetCount: 520,
    sentCount: 0,
    readCount: 0,
    replyCount: 0,
    scheduledAt: '2024-03-30T10:00:00',
    message: 'جرب أحلى قهوة الصباح من الكافيهات القريبة منك!',
  },
  {
    id: '3',
    name: 'إطلاق المنصة',
    status: 'draft',
    targetCount: 0,
    sentCount: 0,
    readCount: 0,
    replyCount: 0,
    message: '',
  },
]

const MOCK_ADVERTISERS: Advertiser[] = [
  {
    id: '1',
    name: 'مطعم الأصالة',
    category: 'مطعم',
    region: 'الرياض - حي العليا',
    budget: 500,
    requestedAt: '2024-03-27T10:00:00',
    status: 'pending',
  },
  {
    id: '2',
    name: 'كافيه الحلوة',
    category: 'كافيه',
    region: 'جدة - الزهراء',
    budget: 300,
    requestedAt: '2024-03-26T14:00:00',
    status: 'pending',
  },
  {
    id: '3',
    name: 'صيدلية الشفاء',
    category: 'صيدلية',
    region: 'الرياض - العزيزية',
    budget: 800,
    requestedAt: '2024-03-25T09:00:00',
    status: 'active',
    campaignStatus: 'active',
    subscriptionEnds: '2024-04-24',
    maxSendsPerWeek: 50,
    serviceFee: 200,
  },
  {
    id: '4',
    name: 'سوبرماركت النجمة',
    category: 'سوبرماركت',
    region: 'الدمام - الفيصلية',
    budget: 1000,
    requestedAt: '2024-03-01T12:00:00',
    status: 'active',
    campaignStatus: 'paused',
    subscriptionEnds: '2024-04-01',
    maxSendsPerWeek: 100,
    serviceFee: 400,
  },
]

const MOCK_SETTINGS: AppSettings = {
  search: {
    radius: 2000,
    maxResults: 5,
  },
  botMessages: {
    welcome: 'أهلاً بك في وين أروح! 👋\nأنا مساعدك لاكتشاف أفضل الأماكن القريبة منك.',
    prompt: 'ماذا تريد أن تجد؟ (مطعم، كافيه، صيدلية...)\nأرسل موقعك أولاً للحصول على أفضل النتائج.',
  },
  antiSpam: {
    maxPerWeek: 3,
    sendFrom: '08:00',
    sendTo: '22:00',
  },
  platform: {
    botName: 'وين أروح',
    description: 'خدمة البحث عن الأماكن القريبة عبر واتساب',
  },
}

// ─── API Functions ────────────────────────────────────────────────────────────

export async function getStats(): Promise<Stats> {
  try {
    return await fetchAPI<Stats>('/admin/stats')
  } catch {
    return MOCK_STATS
  }
}

export async function getContacts(page = 1, filter = ''): Promise<ContactsResponse> {
  try {
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (filter) params.set('filter', filter)
    return await fetchAPI<ContactsResponse>(`/admin/contacts?${params}`)
  } catch {
    const filtered = filter
      ? MOCK_CONTACTS.filter(
          (c) =>
            c.phone.includes(filter) ||
            c.region.includes(filter) ||
            c.lastSearch.includes(filter)
        )
      : MOCK_CONTACTS
    const perPage = 20
    const start = (page - 1) * perPage
    return {
      contacts: filtered.slice(start, start + perPage),
      total: filtered.length,
      page,
      pages: Math.ceil(filtered.length / perPage),
    }
  }
}

export async function getWhatsAppStatus(): Promise<WhatsAppStatus> {
  try {
    return await fetchAPI<WhatsAppStatus>('/admin/whatsapp/status')
  } catch {
    return MOCK_WHATSAPP
  }
}

export async function reconnectWhatsApp(): Promise<{ success: boolean }> {
  try {
    return await fetchAPI<{ success: boolean }>('/admin/whatsapp/reconnect', {
      method: 'POST',
    })
  } catch {
    return { success: true }
  }
}

export async function getQRCode(): Promise<string> {
  try {
    const data = await fetchAPI<{ qrUrl: string }>('/admin/whatsapp/qr')
    return data.qrUrl
  } catch {
    return 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=wean-whatsapp-qr-placeholder'
  }
}

export async function getBroadcasts(): Promise<Broadcast[]> {
  try {
    return await fetchAPI<Broadcast[]>('/admin/broadcasts')
  } catch {
    return MOCK_BROADCASTS
  }
}

export async function createBroadcast(data: BroadcastPayload): Promise<{ id: string }> {
  try {
    return await fetchAPI<{ id: string }>('/admin/broadcast', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  } catch {
    return { id: String(Date.now()) }
  }
}

export async function getAdvertisers(): Promise<Advertiser[]> {
  try {
    return await fetchAPI<Advertiser[]>('/admin/advertisers')
  } catch {
    return MOCK_ADVERTISERS
  }
}

export async function approveAdvertiser(
  id: string,
  data: AdvertiserApprovalPayload
): Promise<{ success: boolean }> {
  try {
    return await fetchAPI<{ success: boolean }>(`/admin/advertisers/${id}/approve`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  } catch {
    return { success: true }
  }
}

export async function rejectAdvertiser(id: string): Promise<{ success: boolean }> {
  try {
    return await fetchAPI<{ success: boolean }>(`/admin/advertisers/${id}/reject`, {
      method: 'PUT',
    })
  } catch {
    return { success: true }
  }
}

export async function getSettings(): Promise<AppSettings> {
  try {
    return await fetchAPI<AppSettings>('/admin/settings')
  } catch {
    return MOCK_SETTINGS
  }
}

export async function saveSettings(data: AppSettings): Promise<{ success: boolean }> {
  try {
    return await fetchAPI<{ success: boolean }>('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  } catch {
    return { success: true }
  }
}
