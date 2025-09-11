'use client'

import { MatchResult } from '@/lib/types/conciliacion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Download, Filter } from 'lucide-react'

interface ResultsTableProps {
  results: MatchResult[]
  onExport?: () => void
  onFilter?: () => void
}

export default function ResultsTable({ results, onExport, onFilter }: ResultsTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'matched':
        return <Badge className="bg-green-100 text-green-600">✅ Conciliado</Badge>
      case 'suggested':
        return <Badge className="bg-yellow-100 text-yellow-600">⏳ Sugerido</Badge>
      case 'pending':
        return <Badge className="bg-orange-100 text-orange-600">⏳ Pendiente</Badge>
      case 'error':
        return <Badge className="bg-red-100 text-red-600">❌ No encontrado</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount)
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date)
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Detalle de Movimientos</h3>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={onFilter}>
            <Filter className="w-4 h-4 mr-2" />
            Filtrar
          </Button>
          <Button size="sm" onClick={onExport}>
            <Download className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
        </div>
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Fecha
              </TableHead>
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Concepto
              </TableHead>
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Monto
              </TableHead>
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Tipo
              </TableHead>
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Estado
              </TableHead>
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Referencia
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((result) => (
              <TableRow key={result.id} className="hover:bg-gray-50">
                <TableCell className="text-sm text-gray-700">
                  {formatDate(result.extractoItem.fechaOperacion)}
                </TableCell>
                <TableCell className="text-sm text-gray-700">
                  {result.extractoItem.concepto}
                </TableCell>
                <TableCell 
                  className={`text-sm font-semibold ${
                    result.extractoItem.importe >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {formatAmount(result.extractoItem.importe)}
                </TableCell>
                <TableCell className="text-sm text-gray-700">
                  {result.extractoItem.importe >= 0 ? 'Crédito' : 'Débito'}
                </TableCell>
                <TableCell>
                  {getStatusBadge(result.status)}
                </TableCell>
                <TableCell className="text-sm font-mono text-xs">
                  {result.extractoItem.referencia || '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}


