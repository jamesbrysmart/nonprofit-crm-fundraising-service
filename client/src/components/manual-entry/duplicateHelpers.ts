import { PersonDuplicate } from '../../api';

export type DuplicateTier = 'exact' | 'review' | 'partial';

export function describeDuplicate(match: PersonDuplicate): string {
  const parts: string[] = [];
  const firstName = match.name?.firstName?.trim() ?? '';
  const lastName = match.name?.lastName?.trim() ?? '';
  const fullName = match.name?.fullName?.trim() ?? '';
  const email = match.emails?.primaryEmail?.trim() ?? '';

  if (fullName.length > 0) {
    parts.push(fullName);
  } else if (firstName || lastName) {
    parts.push(`${firstName} ${lastName}`.trim());
  }

  if (email.length > 0) {
    parts.push(`<${email}>`);
  }

  return parts.length > 0 ? parts.join(' ') : 'Existing donor';
}

export function classifyDuplicate(match: PersonDuplicate, state: {
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
}): DuplicateTier {
  const contactEmail = state.contactEmail.trim().toLowerCase();
  const matchEmail = match.emails?.primaryEmail?.trim().toLowerCase() ?? '';
  if (contactEmail && matchEmail && contactEmail === matchEmail) {
    return 'exact';
  }

  const contactFull = `${state.contactFirstName} ${state.contactLastName}`
    .trim()
    .toLowerCase();
  const matchFull = (
    match.name?.fullName ??
    `${match.name?.firstName ?? ''} ${match.name?.lastName ?? ''}`
  )
    .trim()
    .toLowerCase();

  if (contactFull && matchFull && contactFull === matchFull) {
    return 'review';
  }

  if (matchFull) {
    const first = state.contactFirstName.trim().toLowerCase();
    const last = state.contactLastName.trim().toLowerCase();
    if ((last && matchFull.includes(last)) || (first && matchFull.includes(first))) {
      return 'review';
    }
  }

  return 'partial';
}

export function duplicateTierLabel(tier: DuplicateTier): string {
  switch (tier) {
    case 'exact':
      return 'Exact email';
    case 'review':
      return 'Likely match';
    default:
      return 'Partial match';
  }
}

export function duplicateTierBadgeClass(tier: DuplicateTier): string {
  switch (tier) {
    case 'exact':
      return 'f-inline-flex f-items-center f-rounded-full f-bg-green-100 f-text-green-700 f-text-xs f-font-semibold f-px-2.5 f-py-0.5';
    case 'review':
      return 'f-inline-flex f-items-center f-rounded-full f-bg-amber-100 f-text-amber-800 f-text-xs f-font-semibold f-px-2.5 f-py-0.5';
    default:
      return 'f-inline-flex f-items-center f-rounded-full f-bg-red-100 f-text-danger f-text-xs f-font-semibold f-px-2.5 f-py-0.5';
  }
}

export function formatMatchDate(value?: string): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toISOString().slice(0, 10);
}

export function buildDuplicateLookupPayload(state: {
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
}) {
  const firstName = state.contactFirstName.trim();
  const lastName = state.contactLastName.trim();
  const email = state.contactEmail.trim();

  return {
    firstName,
    lastName,
    email: email.length > 0 ? email : undefined,
    depth: 1,
  };
}
