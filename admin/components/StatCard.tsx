import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  color: 'green' | 'blue' | 'orange' | 'purple'
  change?: string
  changeType?: 'up' | 'down'
  loading?: boolean
}

const colorMap = {
  green: {
    bg: 'bg-green-50',
    icon: 'bg-green-100 text-green-600',
    text: 'text-green-600',
  },
  blue: {
    bg: 'bg-blue-50',
    icon: 'bg-blue-100 text-blue-600',
    text: 'text-blue-600',
  },
  orange: {
    bg: 'bg-orange-50',
    icon: 'bg-orange-100 text-orange-600',
    text: 'text-orange-600',
  },
  purple: {
    bg: 'bg-purple-50',
    icon: 'bg-purple-100 text-purple-600',
    text: 'text-purple-600',
  },
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  color,
  change,
  changeType,
  loading = false,
}: StatCardProps) {
  const colors = colorMap[color]

  if (loading) {
    return (
      <div className="admin-card p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="skeleton h-4 w-28 mb-3" />
            <div className="skeleton h-8 w-20 mb-2" />
            <div className="skeleton h-3 w-16" />
          </div>
          <div className="skeleton w-12 h-12 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="admin-card p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-500 font-medium mb-1">{title}</p>
          <p className="text-3xl font-bold text-slate-800 mb-2">
            {typeof value === 'number' ? value.toLocaleString('ar-SA') : value}
          </p>
          {change && (
            <div
              className={`flex items-center gap-1 text-xs font-medium ${
                changeType === 'up' ? 'text-green-600' : 'text-red-500'
              }`}
            >
              <span>{changeType === 'up' ? '↑' : '↓'}</span>
              <span>{change}</span>
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colors.icon}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  )
}
