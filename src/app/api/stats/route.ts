import { NextResponse } from 'next/server'

export async function GET() {
  // Mock data for now - in production this would call the real LangChain service
  const stats = {
    totalContacts: 4827,
    searchesToday: 312,
    activeAdvertisers: 18,
    messagesSent: 15640,
    topPlaces: [
      { label: 'مطعم', percentage: 45, count: 1247 },
      { label: 'كافيه', percentage: 28, count: 876 },
      { label: 'صيدلية', percentage: 12, count: 376 },
      { label: 'سوبرماركت', percentage: 9, count: 281 },
      { label: 'مسجد', percentage: 6, count: 188 },
    ],
    searchesByDay: [
      { date: '2024-03-22', count: 245 },
      { date: '2024-03-23', count: 312 },
      { date: '2024-03-24', count: 287 },
      { date: '2024-03-25', count: 356 },
      { date: '2024-03-26', count: 298 },
      { date: '2024-03-27', count: 334 },
      { date: '2024-03-28', count: 312 },
    ],
    searchesByCity: [
      { city: 'الرياض', count: 1523 },
      { city: 'جدة', count: 987 },
      { city: 'مكة', count: 654 },
      { city: 'الدمام', count: 432 },
      { city: 'المدينة', count: 321 },
    ],
  }

  return NextResponse.json(stats)
}
