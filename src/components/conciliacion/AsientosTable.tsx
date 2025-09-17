import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Copy } from "lucide-react";
import { AsientoContable } from "@/lib/types/conciliacion";
import { useState } from "react";

interface AsientosTableProps {
  data: AsientoContable[];
}

export function AsientosTable({ data }: AsientosTableProps) {
  const [copied, setCopied] = useState(false);

  const formatCurrency = (amount: number) => {
    if (amount === 0) return '-';
    return `$${amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  };

  const totalDebe = data.reduce((sum, asiento) => sum + asiento.debe, 0);
  const totalHaber = data.reduce((sum, asiento) => sum + asiento.haber, 0);

  const exportToExcel = () => {
    // Crear CSV para exportar
    const headers = ['Fecha', 'Concepto', 'Cuenta', 'Debe', 'Haber', 'Descripción'];
    const rows = data.map(asiento => [
      asiento.fecha,
      asiento.concepto,
      asiento.cuenta,
      asiento.debe.toFixed(2),
      asiento.haber.toFixed(2),
      asiento.descripcion || ''
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `asientos_contables_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const copyToClipboard = () => {
    const text = data.map(asiento => 
      `${asiento.fecha}\t${asiento.concepto}\t${asiento.cuenta}\t${asiento.debe}\t${asiento.haber}`
    ).join('\n');
    
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No se generaron asientos contables para este período.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header con acciones */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          Detalle de Asientos ({data.length})
        </h3>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={copyToClipboard}
            className="flex items-center gap-2"
          >
            <Copy className="w-4 h-4" />
            {copied ? 'Copiado!' : 'Copiar'}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportToExcel}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Tabla de asientos */}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[100px]">Fecha</TableHead>
              <TableHead className="w-[200px]">Concepto</TableHead>
              <TableHead className="min-w-[250px]">Cuenta</TableHead>
              <TableHead className="text-right w-[120px]">Debe</TableHead>
              <TableHead className="text-right w-[120px]">Haber</TableHead>
              <TableHead className="w-[100px]">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((asiento, index) => (
              <TableRow key={asiento.id || index} className="hover:bg-muted/30">
                <TableCell className="font-mono text-sm">
                  {asiento.fecha}
                </TableCell>
                <TableCell className="font-medium">
                  {asiento.concepto}
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{asiento.cuenta}</div>
                    {asiento.descripcion && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {asiento.descripcion}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">
                  <span className={asiento.debe > 0 ? 'text-green-600 font-semibold' : 'text-muted-foreground'}>
                    {formatCurrency(asiento.debe)}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono">
                  <span className={asiento.haber > 0 ? 'text-blue-600 font-semibold' : 'text-muted-foreground'}>
                    {formatCurrency(asiento.haber)}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {asiento.debe > 0 ? 'Debe' : 'Haber'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            
            {/* Fila de totales */}
            <TableRow className="border-t-2 bg-muted/30 font-bold">
              <TableCell colSpan={3} className="text-right">
                <strong>TOTALES:</strong>
              </TableCell>
              <TableCell className="text-right font-mono">
                <span className="text-green-600 font-bold">
                  {formatCurrency(totalDebe)}
                </span>
              </TableCell>
              <TableCell className="text-right font-mono">
                <span className="text-blue-600 font-bold">
                  {formatCurrency(totalHaber)}
                </span>
              </TableCell>
              <TableCell>
                {Math.abs(totalDebe - totalHaber) < 0.01 ? (
                  <Badge className="bg-green-100 text-green-800">
                    ✓ Balance
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    ⚠ Diferencia
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Información adicional */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="bg-green-50 p-3 rounded-lg border border-green-200">
          <p className="font-semibold text-green-800">Total Debe</p>
          <p className="text-lg font-bold text-green-600">
            {formatCurrency(totalDebe)}
          </p>
        </div>
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
          <p className="font-semibold text-blue-800">Total Haber</p>
          <p className="text-lg font-bold text-blue-600">
            {formatCurrency(totalHaber)}
          </p>
        </div>
        <div className={`p-3 rounded-lg border ${
          Math.abs(totalDebe - totalHaber) < 0.01 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <p className={`font-semibold ${
            Math.abs(totalDebe - totalHaber) < 0.01 ? 'text-green-800' : 'text-red-800'
          }`}>
            Diferencia
          </p>
          <p className={`text-lg font-bold ${
            Math.abs(totalDebe - totalHaber) < 0.01 ? 'text-green-600' : 'text-red-600'
          }`}>
            {formatCurrency(Math.abs(totalDebe - totalHaber))}
          </p>
        </div>
      </div>
    </div>
  );
}



