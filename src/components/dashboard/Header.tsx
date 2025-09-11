'use client'

import { Button } from '@/components/ui/button'
import { HelpCircle } from 'lucide-react'

interface HeaderProps {
  title: string
}

export default function Header({ title }: HeaderProps) {
  const currentDate = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <header className="bg-white px-8 py-4 border-b border-gray-200 flex justify-between items-center">
      <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
      <div className="flex gap-4 items-center">
        <span className="text-gray-500 text-sm">{currentDate}</span>
        <Button variant="outline" size="sm">
          <HelpCircle className="w-4 h-4 mr-2" />
          Ayuda
        </Button>
      </div>
    </header>
  )
}


