import { ReactNode } from 'react';
import { SectionHeader } from '../common/SectionHeader';

interface RecurringAssociationsCardProps {
  children: ReactNode;
}

export function RecurringAssociationsCard({
  children,
}: RecurringAssociationsCardProps): JSX.Element {
  return (
    <div className="f-card f-p-5 f-space-y-4">
      <SectionHeader
        eyebrow="Section 3"
        title="Recurring & associations"
        description="Associate this gift with an existing recurring agreement when needed."
      />
      {children}
    </div>
  );
}
