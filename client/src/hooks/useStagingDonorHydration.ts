import { useEffect, useState } from 'react';
import { fetchPersonById } from '../api/people';
import { DonorDisplay } from '../types/donor';
import { fallbackCompanyDisplay, personRecordToDisplay } from '../utils/donorAdapters';

export function useStagingDonorHydration(candidateIds: string[] | undefined) {
  const [candidates, setCandidates] = useState<DonorDisplay[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ids = (candidateIds || []).filter((id) => typeof id === 'string' && id.trim().length > 0);
    if (ids.length === 0) {
      setCandidates([]);
      return;
    }

    let cancelled = false;
    async function hydrate() {
      setLoading(true);
      const results: DonorDisplay[] = [];
      for (const id of ids) {
        const record = await fetchPersonById(id);
        if (record) {
          results.push(personRecordToDisplay(record));
        } else {
          results.push(fallbackCompanyDisplay(id));
        }
      }
      if (!cancelled) {
        setCandidates(results);
        setLoading(false);
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [candidateIds]);

  return { candidates, loading };
}
