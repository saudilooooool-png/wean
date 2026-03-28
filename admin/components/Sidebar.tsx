'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Megaphone,
  Store,
  Settings,
  X,
  Menu,
  Wifi,
  WifiOff,
} from 'lucide-react'

const navLinks = [
  { href: '/', label: 'لوحة التحكم', icon: LayoutDashboard },
  { href: '/whatsapp', label: 'واتساب', icon: MessageSquare },
  { href: '/contacts', label: 'جهات الاتصال', icon: Users },
  { href: '/broadcasts', label: 'الحملات', icon: Megaphone },
  { href: '/advertisers', label: 'المعلنين', icon: Store },
  { href: '/settings', label: 'الإعدادات', icon: Settings },
]

interface SidebarProps {
  connected?: boolean
}

export default function Sidebar({ connected = true }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo / Brand */}
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
            style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}
          >
            و
          </div>
          <div>
            <div className="font-bold text-slate-800 text-base leading-tight">وين أروح</div>
            <div className="text-xs text-slate-400">لوحة الإدارة</div>
          </div>
        </div>
      </div>

      {/* Connection status */}
      <div className="px-4 py-3 border-b border-slate-100">
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
            connected ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
          }`}
        >
          {connected ? (
            <Wifi size={14} className="flex-shrink-0" />
          ) : (
            <WifiOff size={14} className="flex-shrink-0" />
          )}
          <span>{connected ? 'واتساب متصل' : 'واتساب غير متصل'}</span>
          <span
            className={`w-2 h-2 rounded-full ms-auto flex-shrink-0 ${
              connected ? 'bg-green-500 status-dot connected' : 'bg-red-500'
            }`}
          />
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-150 group ${
                    active
                      ? 'nav-link-active'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  <Icon
                    size={18}
                    className={`flex-shrink-0 nav-icon ${
                      active ? 'text-whatsapp-green' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  <span className="font-medium">{label}</span>
                  {active && (
                    <span
                      className="w-1.5 h-1.5 rounded-full ms-auto"
                      style={{ background: '#25D366' }}
                    />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-100">
        <div className="text-xs text-slate-400 text-center">
          <div>وين أروح © 2024</div>
          <div className="mt-1">الإصدار 1.0.0</div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-l border-slate-200 h-screen sticky top-0 overflow-hidden flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="فتح القائمة"
        >
          <Menu size={20} className="text-slate-600" />
        </button>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}
          >
            و
          </div>
          <span className="font-bold text-slate-800">وين أروح</span>
        </div>
        <div
          className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${
            connected ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
          />
          {connected ? 'متصل' : 'غير متصل'}
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`lg:hidden fixed top-0 right-0 h-full w-72 bg-white z-50 shadow-2xl transform transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <button
            onClick={() => setMobileOpen(false)}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="إغلاق القائمة"
          >
            <X size={18} className="text-slate-600" />
          </button>
          <span className="font-bold text-slate-700">القائمة</span>
        </div>
        <SidebarContent />
      </aside>
    </>
  )
}
