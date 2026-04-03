import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import { Toaster } from '@/components/ui/sonner'

export const metadata: Metadata = {
  title: 'وين أروح - لوحة الإدارة',
  description: 'لوحة إدارة منصة وين أروح للبحث عن الأماكن عبر واتساب',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="font-arabic bg-slate-50 text-slate-800 antialiased" dir="rtl">
        <div className="flex min-h-screen flex-row-reverse">
          <Sidebar />
          <main className="flex-1 min-h-screen overflow-auto">
            {/* Mobile top padding */}
            <div className="h-14 lg:hidden" />
            <div className="p-4 lg:p-6 max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  )
}
