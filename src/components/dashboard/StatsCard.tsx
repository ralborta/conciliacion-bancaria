interface StatsCardProps {
  label: string
  value: string | number
  change: string
  changeType: 'positive' | 'negative'
}

export default function StatsCard({ label, value, change, changeType }: StatsCardProps) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">
        {label}
      </div>
      <div className="text-3xl font-bold text-gray-900 mb-1">
        {value}
      </div>
      <div className={`text-sm font-medium ${
        changeType === 'positive' ? 'text-green-600' : 'text-red-600'
      }`}>
        {change}
      </div>
    </div>
  )
}






