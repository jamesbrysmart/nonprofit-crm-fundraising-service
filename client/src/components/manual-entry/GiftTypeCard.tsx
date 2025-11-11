import { ReactNode } from 'react';
import { SectionHeader } from '../common/SectionHeader';

export function GiftTypeCard({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="f-card f-p-5 f-space-y-4">
      <SectionHeader
        eyebrow="Setup"
        title="Gift type"
        description="Choose the intake scenario to surface the right fields."
      />
      {children}
    </div>
  );
}
