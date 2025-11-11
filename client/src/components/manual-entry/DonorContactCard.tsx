import { ReactNode } from 'react';
import { SectionHeader } from '../common/SectionHeader';

export function DonorContactCard({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="f-card f-p-5 f-space-y-4">
      <SectionHeader
        eyebrow="Section 2"
        title="Donor & contact"
        description="Capture contact details, confirm duplicates, and search the directory."
      />
      {children}
    </div>
  );
}
