'use client'

import { MessageCircle, Phone, Video, MoreVertical } from 'lucide-react'

interface PhoneMockupProps {
  message: string
  botName?: string
}

export default function PhoneMockup({ message, botName = 'وين أروح' }: PhoneMockupProps) {
  const now = new Date()
  const timeStr = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex justify-center">
      <div className="phone-mockup">
        {/* Phone screen */}
        <div className="phone-screen" style={{ paddingTop: '24px' }}>
          {/* WhatsApp Header */}
          <div className="phone-header">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              و
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold leading-tight">{botName}</div>
              <div className="text-xs opacity-70">متصل الآن</div>
            </div>
            <div className="flex gap-3 text-white opacity-80">
              <Video size={16} />
              <Phone size={16} />
              <MoreVertical size={16} />
            </div>
          </div>

          {/* Date divider */}
          <div className="flex justify-center my-2">
            <span
              className="text-xs px-3 py-1 rounded-full"
              style={{ background: 'rgba(0,0,0,0.1)', color: '#666', fontSize: '11px' }}
            >
              اليوم
            </span>
          </div>

          {/* Messages */}
          <div className="phone-messages">
            {/* User message */}
            <div className="phone-bubble outgoing" style={{ direction: 'rtl' }}>
              <p className="text-xs">مرحباً! أبحث عن مطعم قريب مني</p>
              <div className="text-right mt-1" style={{ fontSize: '10px', color: '#888' }}>
                {timeStr} ✓✓
              </div>
            </div>

            {/* Bot response */}
            <div className="phone-bubble incoming" style={{ direction: 'rtl' }}>
              <p className="text-xs whitespace-pre-wrap">
                {message || 'أهلاً! اكتب ما تبحث عنه وسأجد لك أقرب الأماكن 📍'}
              </p>
              <div className="text-right mt-1" style={{ fontSize: '10px', color: '#888' }}>
                {timeStr}
              </div>
            </div>
          </div>

          {/* Input bar */}
          <div className="phone-input-bar">
            <div
              className="flex-1 rounded-full px-3 py-2"
              style={{ background: 'white', fontSize: '12px', color: '#aaa' }}
            >
              اكتب رسالة...
            </div>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: '#25D366' }}
            >
              <MessageCircle size={14} color="white" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
