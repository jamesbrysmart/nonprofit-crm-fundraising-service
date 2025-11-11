import { ReactNode } from 'react';

interface OperationsWorkspaceProps {
  leftColumn: ReactNode;
  rightColumn: ReactNode;
  leftTitle: string;
  rightTitle: string;
  description?: ReactNode;
}

export function OperationsWorkspace({
  leftColumn,
  rightColumn,
  leftTitle,
  rightTitle,
  description,
}: OperationsWorkspaceProps): JSX.Element {
  return (
    <div className="f-grid f-gap-6 xl:f-gap-8 xl:f-grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
      <section className="section-unstyled f-space-y-4">
        <div>
          <p className="f-text-xs f-uppercase f-tracking-[0.08em] f-text-slate-500 f-m-0">
            Operations
          </p>
          <h3 className="f-text-xl f-font-semibold f-text-ink f-mt-1 f-mb-0">{leftTitle}</h3>
          {description ? <div className="small-text f-mt-1">{description}</div> : null}
        </div>
        <div className="f-space-y-4">{leftColumn}</div>
      </section>

      <section className="section-unstyled f-space-y-4">
        <div>
          <p className="f-text-xs f-uppercase f-tracking-[0.08em] f-text-slate-500 f-m-0">
            Manual intake
          </p>
          <h3 className="f-text-xl f-font-semibold f-text-ink f-mt-1 f-mb-0">{rightTitle}</h3>
        </div>
        <div className="f-card f-p-5">{rightColumn}</div>
      </section>
    </div>
  );
}
