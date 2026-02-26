import { useMemo } from "react";

export function usePlannerFilteredTreeIdSet(filteredTreeIds: string[]) {
  return useMemo(() => new Set(filteredTreeIds), [filteredTreeIds]);
}
