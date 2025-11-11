import { ReactNode } from 'react';
import { SectionHeader } from '../common/SectionHeader';

export function GiftBasicsCard({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="f-card f-p-5 f-space-y-4">
      <SectionHeader
        eyebrow="Section 1"
        title="Gift basics"
        description="Amount, date, and coding details for this donation."
      />
      {children}
    </div>
  );
}
