import { ReactNode } from 'react';
import { SectionHeader } from '../common/SectionHeader';

interface DonorContactCardProps {
  children: ReactNode;
  eyebrow?: string;
  title?: string;
  description?: string;
}

export function DonorContactCard({
  children,
  eyebrow = 'Section 2',
  title = 'Donor & contact',
  description = 'Capture contact details, confirm duplicates, and search the directory.',
}: DonorContactCardProps): JSX.Element {
  return (
    <div className="f-card f-p-5 f-space-y-4">
      <SectionHeader eyebrow={eyebrow} title={title} description={description} />
      {children}
    </div>
  );
}
