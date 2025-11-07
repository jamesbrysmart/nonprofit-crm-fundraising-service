import { FormEvent, useState } from 'react';
import type { PersonDuplicate } from '../api';
import { findPersonDuplicates } from '../api';

interface ContactSearchProps {
  label: string;
  onSelect(contact: PersonDuplicate | null): void;
  selectedContact?: PersonDuplicate | null;
  helperText?: string;
}

const getDisplayName = (contact: PersonDuplicate): string => {
  if (contact?.name?.fullName) {
    return contact.name.fullName;
  }
  const first = contact?.name?.firstName ?? '';
  const last = contact?.name?.lastName ?? '';
  return [first, last].filter(Boolean).join(' ').trim() || 'Unknown contact';
};

const parseSearchTerm = (
  term: string,
): { firstName: string; lastName: string; email?: string } | null => {
  const trimmed = term.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.includes('@')) {
    const parts = trimmed.split(/\s+/);
    const email = parts.find(fragment => fragment.includes('@')) ?? trimmed;
    const remaining = trimmed.replace(email, '').trim();
    if (remaining.length === 0) {
      return null;
    }
    const tokens = remaining.split(/\s+/);
    if (tokens.length < 2) {
      return null;
    }
    return {
      firstName: tokens[0],
      lastName: tokens.slice(1).join(' '),
      email,
    };
  }

  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 2) {
    return null;
  }

  return {
    firstName: tokens[0],
    lastName: tokens.slice(1).join(' '),
  };
};

export function ContactSearch({
  label,
  onSelect,
  selectedContact,
  helperText,
}: ContactSearchProps): JSX.Element {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<PersonDuplicate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async () => {
    setError(null);
    setResults([]);

    const parsed = parseSearchTerm(term);
    if (!parsed) {
      setError('Enter a first and last name, optionally including an email address.');
      return;
    }

    setLoading(true);
    try {
      const matches = await findPersonDuplicates({
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        email: parsed.email,
        depth: 1,
      });
      setResults(matches);
      if (matches.length === 0) {
        setError('No contacts found for that search.');
      }
    } catch (searchError) {
      const message =
        searchError instanceof Error ? searchError.message : 'Contact search failed.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    await runSearch();
  };

  const handleSelect = (contact: PersonDuplicate) => {
    onSelect(contact);
    setResults([]);
    setError(null);
    if (contact?.name?.fullName) {
      setTerm(contact.name.fullName);
    }
  };

  const handleClear = () => {
    onSelect(null);
    setResults([]);
    setError(null);
    setTerm('');
  };

  return (
    <div className="contact-search">
      <div className="contact-search__form">
        <label>
          <span>{label}</span>
          <div className="contact-search__input-row">
            <input
              type="text"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Enter name (and optional email)"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
            />
            <button type="button" onClick={() => void handleSubmit()} disabled={loading}>
              {loading ? 'Searching…' : 'Search'}
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={!selectedContact && term.trim().length === 0}
            >
              Clear
            </button>
          </div>
        </label>
        {helperText ? <p className="small-text">{helperText}</p> : null}
        {selectedContact ? (
          <p className="small-text">
            Selected: <strong>{getDisplayName(selectedContact)}</strong>
            {selectedContact.emails?.primaryEmail
              ? ` (${selectedContact.emails.primaryEmail})`
              : ''}
          </p>
        ) : null}
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      {results.length > 0 ? (
        <ul className="contact-search__results">
          {results.map((contact) => {
            const key = contact.id ?? getDisplayName(contact);
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => handleSelect(contact)}
                  className="link-button"
                >
                  {getDisplayName(contact)}
                  {contact.emails?.primaryEmail ? ` — ${contact.emails.primaryEmail}` : ''}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
