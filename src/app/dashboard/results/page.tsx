'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import StatsCard from '@/components/dashboard/StatsCard'
import ResultsTable from '@/components/conciliacion/ResultsTable'
import MatchingDetails from '@/components/conciliacion/MatchingDetails'
import { MatchResult, ConciliationStats } from '@/lib/types/conciliacion'

function ResultsContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('sessionId')
  
  const [results, setResults] = useState<MatchResult[]>([])
  const [stats, setStats] = useState<ConciliationStats>({
    totalMovimientos: 0,
    conciliados: 0,
    pendientes: 0,
    montoTotal: 0,
    porcentajeConciliacion: 0
  })
  const [selectedResult] = useState<MatchResult | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (sessionId) {
      fetchResults(sessionId)
    }
  }, [sessionId])

  const fetchResults = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/conciliation/results/${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        setResults(data.results)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error fetching results:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    if (!sessionId) return
    
    try {
      const response = await fetch(`/api/conciliation/export/${sessionId}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `conciliacion_${sessionId}.xlsx`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Error exporting results:', error)
    }
  }


  const handleAcceptMatch = (result: MatchResult) => {
    setResults(prev => 
      prev.map(r => 
        r.id === result.id 
          ? { ...r, status: 'matched' as const }
          : r
      )
    )
    setIsDetailsOpen(false)
  }

  const handleRejectMatch = (result: MatchResult) => {
    setResults(prev => 
      prev.map(r => 
        r.id === result.id 
          ? { ...r, status: 'pending' as const }
          : r
      )
    )
    setIsDetailsOpen(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando resultados...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-6">
        <StatsCard
          label="Total Movimientos"
          value={stats.totalMovimientos.toLocaleString()}
          change="+12% vs mes anterior"
          changeType="positive"
        />
        <StatsCard
          label="Conciliados"
          value={`${Math.round(stats.porcentajeConciliacion)}%`}
          change={`${stats.conciliados} movimientos`}
          changeType="positive"
        />
        <StatsCard
          label="Pendientes"
          value={`${Math.round(100 - stats.porcentajeConciliacion)}%`}
          change={`${stats.pendientes} movimientos`}
          changeType="negative"
        />
        <StatsCard
          label="Monto Total"
          value={`$${(stats.montoTotal / 1000000).toFixed(1)}M`}
          change="+8% vs mes anterior"
          changeType="positive"
        />
      </div>

      {/* Results Table */}
      <ResultsTable
        results={results}
        onExport={handleExport}
        onFilter={() => console.log('Filter clicked')}
      />

      {/* Matching Details Modal */}
      <MatchingDetails
        result={selectedResult}
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        onAccept={handleAcceptMatch}
        onReject={handleRejectMatch}
      />
    </div>
  )
}

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando resultados...</p>
        </div>
      </div>
    }>
      <ResultsContent />
    </Suspense>
  )
}
