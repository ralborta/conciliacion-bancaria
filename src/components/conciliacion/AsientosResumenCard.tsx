import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle } from "lucide-react";
import { AsientosResumen } from "@/lib/types/conciliacion";

interface AsientosResumenCardProps {
  data: AsientosResumen;
}

export function AsientosResumenCard({ data }: AsientosResumenCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📊 Asientos Contables
          {data.balanceado ? (
            <Badge variant="default" className="bg-green-100 text-green-800">
              <CheckCircle className="w-3 h-3 mr-1" />
              Balanceado
            </Badge>
          ) : (
            <Badge variant="destructive">
              <AlertCircle className="w-3 h-3 mr-1" />
              Desbalanceado
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Debe</p>
            <p className="text-2xl font-bold text-green-600">
              ${data.totalDebe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Haber</p>
            <p className="text-2xl font-bold text-blue-600">
              ${data.totalHaber.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Asientos generados</p>
            <p className="font-semibold">{data.totalAsientos}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Diferencia</p>
            <p className={`font-semibold ${data.diferencia < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
              ${data.diferencia.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {Object.keys(data.asientosPorTipo).length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm font-medium mb-2">Tipos de asientos:</p>
            <div className="space-y-1">
              {Object.entries(data.asientosPorTipo).slice(0, 3).map(([tipo, datos]) => (
                <div key={tipo} className="flex justify-between text-xs">
                  <span className="truncate flex-1 mr-2">{tipo}</span>
                  <span className="text-muted-foreground">{datos.cantidad}</span>
                </div>
              ))}
              {Object.keys(data.asientosPorTipo).length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{Object.keys(data.asientosPorTipo).length - 3} más...
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}









