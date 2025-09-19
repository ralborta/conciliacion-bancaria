import { useState, useMemo } from 'react';
import { AsientoContable } from '@/lib/types/conciliacion';

export function useAsientos(asientos: AsientoContable[]) {
  const [sortBy, setSortBy] = useState<'fecha' | 'cuenta' | 'debe' | 'haber'>('fecha');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterBy, setFilterBy] = useState<'all' | 'debe' | 'haber'>('all');

  const filteredAndSortedAsientos = useMemo(() => {
    let filtered = [...asientos];

    // Filtrar
    if (filterBy === 'debe') {
      filtered = filtered.filter(a => a.debe > 0);
    } else if (filterBy === 'haber') {
      filtered = filtered.filter(a => a.haber > 0);
    }

    // Ordenar
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'fecha':
          aValue = new Date(a.fecha.split('/').reverse().join('-')).getTime();
          bValue = new Date(b.fecha.split('/').reverse().join('-')).getTime();
          break;
        case 'cuenta':
          aValue = a.cuenta.toLowerCase();
          bValue = b.cuenta.toLowerCase();
          break;
        case 'debe':
          aValue = a.debe;
          bValue = b.debe;
          break;
        case 'haber':
          aValue = a.haber;
          bValue = b.haber;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [asientos, sortBy, sortOrder, filterBy]);

  const statistics = useMemo(() => {
    const totalDebe = filteredAndSortedAsientos.reduce((sum, a) => sum + a.debe, 0);
    const totalHaber = filteredAndSortedAsientos.reduce((sum, a) => sum + a.haber, 0);
    
    return {
      count: filteredAndSortedAsientos.length,
      totalDebe,
      totalHaber,
      difference: Math.abs(totalDebe - totalHaber),
      balanced: Math.abs(totalDebe - totalHaber) < 0.01
    };
  }, [filteredAndSortedAsientos]);

  return {
    asientos: filteredAndSortedAsientos,
    statistics,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    filterBy,
    setFilterBy
  };
}









