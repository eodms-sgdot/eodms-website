import { useEffect, useState } from 'react';
import type { FilterValue } from '../../types';

/**
 * Custom hook to sync local filter state with filterData.
 * Automatically resets local value and operation when filterData changes.
 */
export function useSyncFilterData(filterData: FilterValue) {
  const [localValue, setLocalValue] = useState<string>((filterData.value as string) ?? '');
  const [localOperation, setLocalOperation] = useState<string>(
    filterData.operation && filterData.operation !== '' ? filterData.operation : '='
  );
  const [valid, setValid] = useState<boolean>(true);

  // Sync local state with filterData when it changes (e.g., when filters are cleared)
  useEffect(() => {
    setLocalValue((filterData.value as string) ?? '');
    setLocalOperation(filterData.operation && filterData.operation !== '' ? filterData.operation : '=');
    setValid(true);
  }, [filterData.value, filterData.operation, filterData.id]);

  return { localValue, setLocalValue, localOperation, setLocalOperation, valid, setValid };
}
