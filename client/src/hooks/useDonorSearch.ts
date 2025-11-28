import { useCallback, useState } from 'react';
import { PersonDuplicate, findPersonDuplicates } from '../api';

export function useDonorSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<PersonDuplicate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(() => {
    setIsOpen(true);
    setSearchTerm('');
    setResults([]);
    setError(null);
    setLoading(false);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setLoading(false);
  }, []);

  const search = useCallback(
    async (event: React.FormEvent<HTMLFormElement>, context?: { firstName?: string; lastName?: string; email?: string }) => {
      event.preventDefault();
      const trimmed = searchTerm.trim();

      let firstName = context?.firstName ?? '';
      let lastName = context?.lastName ?? '';
      let email = context?.email ?? '';

      // If the user typed something, try to parse it
      if (trimmed.length > 0) {
        if (trimmed.includes('@')) {
          email = trimmed;
          // If we are searching by email, we might want to clear names if they contradict?
          // But usually we just send what we have.
          // For simplicity, let's prioritize the search term.
        } else {
          const parts = trimmed.split(/\s+/);
          if (parts.length === 1) {
            firstName = parts[0];
            // If we only have one name part, we might clear lastName or keep context?
            // Let's assume the search term *overrides* the context if present.
            lastName = '';
          } else {
            firstName = parts[0];
            lastName = parts.slice(1).join(' ');
          }
        }
      } else {
        // If search term is empty, rely on context (if we want "default" search?)
        // Usually search requires input.
        if (!firstName && !lastName && !email) {
          setError('Provide a name or email to search.');
          setResults([]);
          return;
        }
      }

      if (firstName.length < 2 && lastName.length < 2 && !email) {
        setError('Provide at least a first and last name, or include an email address.');
        setResults([]);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const matches = await findPersonDuplicates({
          firstName,
          lastName,
          email: email && email.length > 0 ? email : undefined,
          depth: 1,
        });
        setResults(matches);
        if (matches.length === 0) {
          setError('No donors found for that search.');
        }
      } catch (err) {
        setResults([]);
        setError(err instanceof Error ? err.message : 'Search failed.');
      } finally {
        setLoading(false);
      }
    },
    [searchTerm],
  );

  return {
    isOpen,
    searchTerm,
    results,
    loading,
    error,
    open,
    close,
    setSearchTerm,
    search,
  };
}
