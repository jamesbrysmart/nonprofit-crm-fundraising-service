import { useState } from 'react';
import { ManualGiftEntry } from './components/ManualGiftEntry';
import { StagingQueue } from './components/gift-staging/StagingQueue';
import { RecurringAgreementList } from './components/RecurringAgreementList';
import { AppealsView } from './components/AppealsView';
import { HouseholdManager } from './components/HouseholdManager';
import { OperationsWorkspace } from './components/OperationsWorkspace';

type ViewMode = 'manual' | 'queue' | 'agreements' | 'appeals' | 'households';

type ViewConfig = {
  label: string;
  description: string;
  group: 'Operations' | 'Data hygiene & records';
  badge?: string;
};

const VIEW_CONFIG: Record<ViewMode, ViewConfig> = {
  queue: {
    label: 'Staging queue',
    description: 'Review staged gifts, resolve duplicates, and process records when ready.',
    group: 'Operations',
    badge: 'Priority',
  },
  manual: {
    label: 'Manual gift entry',
    description: 'Log cheques, phone donations, and corrections straight into staging.',
    group: 'Operations',
  },
  agreements: {
    label: 'Recurring agreements',
    description: 'Monitor Stripe/GoCardless plans and triage overdue or paused agreements.',
    group: 'Data hygiene & records',
  },
  appeals: {
    label: 'Appeals',
    description: 'Manage simple appeal metadata, targets, and solicitation snapshots.',
    group: 'Data hygiene & records',
  },
  households: {
    label: 'Households',
    description: 'Pilot tooling to group supporters and manage shared mailing details.',
    group: 'Data hygiene & records',
  },
};

const NAV_GROUPS: Array<{ label: string; items: ViewMode[] }> = [
  {
    label: 'Operations',
    items: ['queue', 'manual'],
  },
  {
    label: 'Data hygiene & records',
    items: ['agreements', 'appeals', 'households'],
  },
];

const classNames = (...classes: Array<string | false | undefined>): string =>
  classes.filter(Boolean).join(' ');

export function App(): JSX.Element {
  const [view, setView] = useState<ViewMode>('queue');
  const activeConfig = VIEW_CONFIG[view];

  return (
    <div className="f-flex f-min-h-screen f-bg-canvas f-text-ink f-antialiased lg:f-flex-row f-flex-col">
      <aside
        className="f-w-full lg:f-w-80 f-bg-ink f-text-slate-100 f-px-7 f-py-10 f-flex f-flex-col f-gap-10 f-border-b f-border-white/10 lg:f-border-b-0"
        aria-label="Fundraising admin navigation"
      >
        <div className="f-flex f-flex-col f-gap-2">
          <p className="f-text-xs f-uppercase f-tracking-[0.08em] f-text-slate-400 f-m-0">
            Managed extension
          </p>
          <h1 className="f-text-2xl f-font-semibold f-text-white f-m-0">Fundraising admin</h1>
          <p className="f-text-sm f-text-slate-200 f-m-0">
            Keep staged gifts moving while staying close to manual entry and supporting data.
          </p>
        </div>

        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="f-flex f-flex-col f-gap-4">
            <p className="f-text-xs f-uppercase f-tracking-[0.08em] f-text-slate-400 f-m-0">
              {group.label}
            </p>
            <ul className="f-list-none f-m-0 f-p-0 f-flex f-flex-col f-gap-2.5">
              {group.items.map((item) => {
                const detail = VIEW_CONFIG[item];
                const isActive = view === item;
                return (
                  <li key={item}>
                    <button
                      type="button"
                      className={classNames(
                        'f-w-full f-text-left f-border f-border-white/10 f-rounded-xl f-bg-white/5 f-text-slate-100 f-px-4 f-py-3 f-transition f-duration-150 f-cursor-pointer hover:f-border-white/30 hover:f-bg-white/10',
                        isActive && 'f-border-cyan-200 f-bg-cyan-50/10',
                      )}
                      onClick={() => setView(item)}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <span className="f-flex f-items-center f-justify-between f-font-semibold">
                        {detail.label}
                        {detail.badge ? (
                          <span className="f-badge f-bg-white/10 f-text-white" aria-label={`${detail.badge} focus`}>
                            {detail.badge}
                          </span>
                        ) : null}
                      </span>
                      <span className="f-block f-mt-1 f-text-xs f-text-slate-300">
                        {detail.description}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </aside>

      <main className="f-flex f-flex-col f-flex-1 f-bg-canvas">
        <header className="f-border-b f-border-slate-200 f-px-6 lg:f-px-10 f-py-8 lg:f-py-10">
          <p className="f-text-xs f-uppercase f-tracking-[0.08em] f-text-slate-500 f-m-0">
            {activeConfig.group}
          </p>
          <div className="f-flex f-items-center f-gap-2 f-flex-wrap">
            <h2 className="f-text-2xl f-font-semibold f-text-ink f-m-0">{activeConfig.label}</h2>
            {activeConfig.badge ? (
              <span className="f-badge f-bg-primary f-text-white">{activeConfig.badge}</span>
            ) : null}
          </div>
          <p className="small-text f-mt-1">{activeConfig.description}</p>
        </header>

        <div className="f-flex-1 f-px-6 lg:f-px-10 f-py-8 lg:f-py-10 f-overflow-y-auto f-space-y-6">
          {view === 'queue' || view === 'manual' ? (
            <OperationsWorkspace
              leftColumn={<StagingQueue />}
              rightColumn={<ManualGiftEntry />}
              leftTitle="Staging queue"
              rightTitle="Manual gift entry"
              description={
                <p className="f-m-0">
                  Review staged gifts, resolve duplicates, and process ready records while keeping manual entry within reach.
                </p>
              }
            />
          ) : view === 'agreements' ? (
            <RecurringAgreementList />
          ) : view === 'appeals' ? (
            <AppealsView />
          ) : (
            <HouseholdManager />
          )}
        </div>
      </main>
    </div>
  );
}
