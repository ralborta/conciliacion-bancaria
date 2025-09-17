import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown } from "lucide-react";

interface AsientosFiltersProps {
  sortBy: 'fecha' | 'cuenta' | 'debe' | 'haber';
  setSortBy: (value: 'fecha' | 'cuenta' | 'debe' | 'haber') => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (value: 'asc' | 'desc') => void;
  filterBy: 'all' | 'debe' | 'haber';
  setFilterBy: (value: 'all' | 'debe' | 'haber') => void;
  totalCount: number;
  filteredCount: number;
}

export function AsientosFilters({
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  filterBy,
  setFilterBy,
  totalCount,
  filteredCount
}: AsientosFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/30 rounded-lg">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Filtrar por:</span>
        <div className="flex gap-1">
          <Button
            variant={filterBy === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterBy('all')}
          >
            Todos
          </Button>
          <Button
            variant={filterBy === 'debe' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterBy('debe')}
            className="text-green-600"
          >
            Debe
          </Button>
          <Button
            variant={filterBy === 'haber' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterBy('haber')}
            className="text-blue-600"
          >
            Haber
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Ordenar por:</span>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fecha">Fecha</SelectItem>
            <SelectItem value="cuenta">Cuenta</SelectItem>
            <SelectItem value="debe">Debe</SelectItem>
            <SelectItem value="haber">Haber</SelectItem>
          </SelectContent>
        </Select>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
        >
          <ArrowUpDown className="w-4 h-4" />
          {sortOrder === 'asc' ? 'Asc' : 'Desc'}
        </Button>
      </div>

      <div className="ml-auto">
        <Badge variant="outline">
          {filteredCount} de {totalCount} asientos
        </Badge>
      </div>
    </div>
  );
}




