import { NextResponse } from 'next/server'

export async function GET() {
  // Return a placeholder QR code URL
  // In production, this would generate a real QR code from Evolution API
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=wean-whatsapp-${Date.now()}`
  
  return NextResponse.json({ qrUrl })
}
