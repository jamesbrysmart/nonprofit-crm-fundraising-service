import { ReactNode } from 'react';
import { SectionHeader } from '../common/SectionHeader';

interface OrganisationDetailsCardProps {
  children: ReactNode;
}

export function OrganisationDetailsCard({ children }: OrganisationDetailsCardProps): JSX.Element {
  return (
    <div className="f-card f-p-5 f-space-y-4">
      <SectionHeader
        eyebrow="Section 2"
        title="Organisation & opportunity"
        description="Link the company or grant record you’re working on."
      />
      {children}
    </div>
  );
}
