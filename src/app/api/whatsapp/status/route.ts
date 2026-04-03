import { NextResponse } from 'next/server'

export async function GET() {
  // Mock WhatsApp status
  const status = {
    connected: true,
    number: '+966500000001',
    instanceName: 'wean-main',
    lastConnected: new Date().toISOString(),
    connectionHistory: [
      { event: 'connected', timestamp: new Date().toISOString(), description: 'تم الاتصال بنجاح' },
      { event: 'disconnected', timestamp: new Date(Date.now() - 86400000).toISOString(), description: 'انقطع الاتصال' },
      { event: 'connected', timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), description: 'تم الاتصال بنجاح' },
    ],
  }

  return NextResponse.json(status)
}

export async function POST() {
  // Reconnect endpoint
  return NextResponse.json({ success: true, message: 'Reconnection initiated' })
}
