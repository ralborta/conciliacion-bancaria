'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { LogOut, User } from 'lucide-react'

const navigation = [
  {
    section: 'Principal',
    items: [
      { href: '/dashboard', label: 'Carga de Archivos', icon: '📤', section: 'upload' },
      { href: '/dashboard/results', label: 'Resultados', icon: '📊', section: 'results' },
    ]
  },
  {
    section: 'Configuración',
    items: [
      { href: '/dashboard/banks', label: 'Bancos', icon: '🏦', section: 'banks' },
      { href: '/dashboard/rules', label: 'Reglas de Matching', icon: '⚙️', section: 'rules' },
      { href: '/dashboard/catalogs', label: 'Catálogos', icon: '📚', section: 'catalogs' },
    ]
  },
  {
    section: 'Reportes',
    items: [
      { href: '/dashboard/history', label: 'Historial', icon: '📜', section: 'history' },
      { href: '/dashboard/exceptions', label: 'Excepciones', icon: '⚠️', section: 'exceptions' },
      { href: '/dashboard/accounting', label: 'Contabilidad', icon: '📒', section: 'accounting' },
    ]
  }
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <aside className="w-[280px] bg-white border-r border-gray-200 flex flex-col fixed h-screen z-50 shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
        <div className="flex items-center gap-3">
          <span className="text-xl">🏦</span>
          <span className="text-xl font-bold">Conciliación Bancaria</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {navigation.map((section) => (
          <div key={section.section} className="mb-2">
            <div className="px-6 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {section.section}
            </div>
            {section.items.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-6 py-3 text-gray-700 hover:bg-gray-50 hover:text-blue-500 transition-all duration-200 relative cursor-pointer',
                    isActive && 'bg-gradient-to-r from-blue-50 to-transparent text-blue-500',
                    isActive && 'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-blue-500'
                  )}
                >
                  <span className="w-5 h-5 flex items-center justify-center text-lg">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User info and logout */}
      <div className="border-t border-gray-200 p-4 bg-gray-50">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.name || 'Usuario'}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {user?.username || 'natero'}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  )
}


