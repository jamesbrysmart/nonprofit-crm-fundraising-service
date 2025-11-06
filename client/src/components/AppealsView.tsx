import { useEffect, useMemo, useState } from 'react';
import {
  AppealRecord,
  AppealCreateRequest,
  fetchAppeals,
  createAppeal,
  updateAppeal,
  fetchSolicitationSnapshots,
  createSolicitationSnapshot,
  MoneyInput,
  SolicitationSnapshotRecord,
} from '../api';
import {
  AppealForm,
  createEmptyAppealForm,
  type AppealFormState,
} from './AppealForm';

const defaultSnapshotForm = () => ({
  count: '',
  source: '',
  capturedAt: '',
});

const parseMoneyInput = (value: string, currency: string): MoneyInput | null => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const numeric = Number.parseFloat(trimmed);
  if (!Number.isFinite(numeric)) {
    throw new Error('Enter a valid amount.');
  }

  const resolvedCurrency = currency.trim().length > 0 ? currency.trim().toUpperCase() : 'GBP';
  return { value: numeric, currencyCode: resolvedCurrency };
};

const parseTargetSolicited = (value: string): number | null => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Target solicited count must be a non-negative integer.');
  }
  return parsed;
};

const formatMoney = (amount?: { value?: number; currencyCode?: string } | null) => {
  if (!amount || typeof amount.value !== 'number') {
    return '—';
  }
  const currency = (amount.currencyCode ?? 'GBP').toUpperCase();
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount.value);
};

const formatRate = (rate?: number | null) => {
  if (rate === undefined || rate === null) {
    return '—';
  }
  return `${(rate * 100).toFixed(1)}%`;
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return '—';
  }
  try {
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));
  } catch {
    return value;
  }
};

export function AppealsView(): JSX.Element {
  const [appeals, setAppeals] = useState<AppealRecord[]>([]);
  const [appealsLoading, setAppealsLoading] = useState(true);
  const [appealsError, setAppealsError] = useState<string | null>(null);
  const [selectedAppealId, setSelectedAppealId] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState<AppealFormState>(createEmptyAppealForm);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createStatus, setCreateStatus] = useState<'idle' | 'saving'>('idle');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<AppealFormState>(createEmptyAppealForm);
  const [editError, setEditError] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<'idle' | 'saving'>('idle');

  const [snapshotForm, setSnapshotForm] = useState(defaultSnapshotForm);
  const [snapshotStatus, setSnapshotStatus] = useState<'idle' | 'saving'>('idle');
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<SolicitationSnapshotRecord[]>([]);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotFetchError, setSnapshotFetchError] = useState<string | null>(null);

  const selectedAppeal = useMemo(
    () => appeals.find((appeal) => appeal.id === selectedAppealId) ?? null,
    [appeals, selectedAppealId],
  );

  const filteredSnapshots = useMemo(() => {
    if (!selectedAppealId) {
      return [];
    }
    return snapshots.filter(
      (snapshot) =>
        typeof snapshot.appealId !== 'string' || snapshot.appealId === selectedAppealId,
    );
  }, [snapshots, selectedAppealId]);

  const buildAppealPayloadFromForm = (form: AppealFormState): AppealCreateRequest => {
    const goalAmount = parseMoneyInput(form.goalAmountValue, form.goalAmountCurrency);
    const budgetAmount = parseMoneyInput(form.budgetAmountValue, form.budgetAmountCurrency);
    const targetSolicitedCount = parseTargetSolicited(form.targetSolicitedCount);
    const name = form.name.trim();

    if (!name) {
      throw new Error('Appeal name is required.');
    }

    return {
      name,
      appealType: form.type.trim() || undefined,
      startDate: form.startDate.trim() || undefined,
      endDate: form.endDate.trim() || undefined,
      description: form.description.trim() || undefined,
      goalAmount: goalAmount ?? undefined,
      budgetAmount: budgetAmount ?? undefined,
      targetSolicitedCount: targetSolicitedCount ?? undefined,
    };
  };

  const mapAppealToForm = (appeal: AppealRecord): AppealFormState => ({
    name: appeal.name ?? '',
    type: appeal.appealType ?? '',
    startDate: appeal.startDate ?? '',
    endDate: appeal.endDate ?? '',
    goalAmountValue:
      appeal.goalAmount?.value !== undefined && appeal.goalAmount?.value !== null
        ? String(appeal.goalAmount.value)
        : '',
    goalAmountCurrency: appeal.goalAmount?.currencyCode ?? 'GBP',
    budgetAmountValue:
      appeal.budgetAmount?.value !== undefined && appeal.budgetAmount?.value !== null
        ? String(appeal.budgetAmount.value)
        : '',
    budgetAmountCurrency: appeal.budgetAmount?.currencyCode ?? 'GBP',
    targetSolicitedCount:
      appeal.targetSolicitedCount !== undefined && appeal.targetSolicitedCount !== null
        ? String(appeal.targetSolicitedCount)
        : '',
    description: appeal.description ?? '',
  });

  const refreshAppeals = async () => {
    setAppealsLoading(true);
    setAppealsError(null);
    try {
      const records = await fetchAppeals({ limit: 100, sort: 'name:asc' });
      setAppeals(records);
      if (records.length > 0) {
        setSelectedAppealId((current) => current ?? records[0]?.id ?? null);
      } else {
        setSelectedAppealId(null);
      }
    } catch (error) {
      setAppealsError(error instanceof Error ? error.message : 'Failed to load appeals.');
    } finally {
      setAppealsLoading(false);
    }
  };

  useEffect(() => {
    void refreshAppeals();
  }, []);

  const loadSnapshots = async (appealId: string) => {
    setSnapshotLoading(true);
    setSnapshotFetchError(null);
    try {
      const records = await fetchSolicitationSnapshots(appealId);
      setSnapshots(records);
    } catch (error) {
      setSnapshotFetchError(
        error instanceof Error
          ? error.message
          : 'Failed to load solicitation snapshots.',
      );
      setSnapshots([]);
    } finally {
      setSnapshotLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedAppealId) {
      setSnapshots([]);
      return;
    }
    void loadSnapshots(selectedAppealId);
  }, [selectedAppealId]);

  useEffect(() => {
    if (selectedAppeal && isEditOpen) {
      setEditForm(mapAppealToForm(selectedAppeal));
    }
  }, [selectedAppeal, isEditOpen]);

  const handleCreateSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (createStatus === 'saving') {
      return;
    }

    try {
      setCreateStatus('saving');
      setCreateError(null);

      const payload = buildAppealPayloadFromForm(createForm);
      await createAppeal(payload);
      setCreateForm(createEmptyAppealForm());
      setIsCreateOpen(false);
      await refreshAppeals();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create appeal.');
    } finally {
      setCreateStatus('idle');
    }
  };

  const handleEditSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editStatus === 'saving' || !selectedAppealId) {
      return;
    }

    try {
      setEditStatus('saving');
      setEditError(null);

      const payload = buildAppealPayloadFromForm(editForm);
      await updateAppeal(selectedAppealId, payload);
      setIsEditOpen(false);
      await refreshAppeals();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Failed to update appeal.');
    } finally {
      setEditStatus('idle');
    }
  };

  const handleSnapshotSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAppealId || snapshotStatus === 'saving') {
      return;
    }

    try {
      setSnapshotStatus('saving');
      setSnapshotError(null);

      const countTrimmed = snapshotForm.count.trim();
      if (countTrimmed.length === 0) {
        throw new Error('Provide a solicited count.');
      }
      const count = Number.parseInt(countTrimmed, 10);
      if (!Number.isFinite(count) || count <= 0) {
        throw new Error('Solicited count must be a positive integer.');
      }

      await createSolicitationSnapshot(selectedAppealId, {
        countSolicited: count,
        source: snapshotForm.source.trim() || undefined,
        capturedAt: snapshotForm.capturedAt.trim() || undefined,
      });

      setSnapshotForm(defaultSnapshotForm());
      await loadSnapshots(selectedAppealId);
    } catch (error) {
      setSnapshotError(
        error instanceof Error ? error.message : 'Failed to log solicitation snapshot.',
      );
    } finally {
      setSnapshotStatus('idle');
    }
  };

  return (
    <section className="appeals-container">
      <header className="appeals-header">
        <div>
          <h2>Appeals</h2>
          <p className="small-text">
            Track fundraising appeals, attribution totals, and solicitation activity. Metrics update
            automatically as gifts land.
          </p>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            setIsCreateOpen(true);
            setCreateError(null);
          }}
        >
          New appeal
        </button>
      </header>

      {appealsLoading ? (
        <div className="appeals-state">Loading appeals…</div>
      ) : appealsError ? (
        <div className="appeals-state appeals-state-error">{appealsError}</div>
      ) : appeals.length === 0 ? (
        <div className="appeals-state">
          No appeals yet. Create the first appeal to start tracking attribution and response rates.
        </div>
      ) : (
        <div className="appeals-grid">
          <div className="appeals-table-wrapper">
            <table className="appeals-table">
              <thead>
                <tr>
                  <th scope="col">Appeal</th>
                  <th scope="col">Type</th>
                  <th scope="col">Dates</th>
                  <th scope="col">Goal</th>
                  <th scope="col">Raised</th>
                  <th scope="col">Gifts</th>
                  <th scope="col">Donors</th>
                  <th scope="col">Response rate</th>
                </tr>
              </thead>
              <tbody>
                {appeals.map((appeal) => (
                  <tr
                    key={appeal.id}
                    className={appeal.id === selectedAppealId ? 'selected' : undefined}
                    onClick={() => setSelectedAppealId(appeal.id)}
                  >
                    <td>
                      <div className="appeal-name">{appeal.name ?? 'Untitled appeal'}</div>
                      {appeal.description ? (
                        <div className="appeal-description">{appeal.description}</div>
                      ) : null}
                    </td>
                    <td>{appeal.appealType ? appeal.appealType.replace(/_/g, ' ') : '—'}</td>
                    <td>
                      {formatDate(appeal.startDate)}
                      {' – '}
                      {formatDate(appeal.endDate)}
                    </td>
                    <td>{formatMoney(appeal.goalAmount)}</td>
                    <td>{formatMoney(appeal.raisedAmount)}</td>
                    <td>{appeal.giftCount ?? '—'}</td>
                    <td>{appeal.donorCount ?? '—'}</td>
                    <td>{formatRate(appeal.responseRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="appeal-detail">
            {selectedAppeal ? (
              <>
                <div className="appeal-detail-header">
                  <div>
                    <h3>{selectedAppeal.name ?? 'Untitled appeal'}</h3>
                    <p className="small-text">
                      Last gift: {formatDate(selectedAppeal.lastGiftAt)} · Goal{' '}
                      {formatMoney(selectedAppeal.goalAmount)} · Raised{' '}
                      {formatMoney(selectedAppeal.raisedAmount)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      if (!selectedAppeal) {
                        return;
                      }
                      setEditForm(mapAppealToForm(selectedAppeal));
                      setEditError(null);
                      setIsEditOpen(true);
                    }}
                  >
                    Edit appeal
                  </button>
                </div>

                <div className="appeal-metrics">
                  <div>
                    <span className="metric-label">Gifts</span>
                    <span className="metric-value">{selectedAppeal.giftCount ?? '—'}</span>
                  </div>
                  <div>
                    <span className="metric-label">Donors</span>
                    <span className="metric-value">{selectedAppeal.donorCount ?? '—'}</span>
                  </div>
                  <div>
                    <span className="metric-label">Response rate</span>
                    <span className="metric-value">{formatRate(selectedAppeal.responseRate)}</span>
                  </div>
                  <div>
                    <span className="metric-label">Cost per £</span>
                    <span className="metric-value">
                      {selectedAppeal.costPerPound
                        ? `£${selectedAppeal.costPerPound.toFixed(2)}`
                        : '—'}
                    </span>
                  </div>
                </div>

                <div className="appeal-dashboard-placeholder">
                  Dashboard visualisations coming soon. We’ll surface channel mix, pacing, and ROI
                  here once Twenty ships the managed dashboard framework.
                </div>

                <div className="solicitation-section">
                  <h4>Solicitation history</h4>
                  {snapshotFetchError ? (
                    <div className="appeals-state appeals-state-error">
                      {snapshotFetchError}
                    </div>
                  ) : snapshotLoading ? (
                    <div className="appeals-state">Loading snapshots…</div>
                  ) : filteredSnapshots.length === 0 ? (
                    <div className="appeals-state">
                      No solicitation snapshots yet. Log sends or counts to track response rate.
                    </div>
                  ) : (
                    <table className="solicitation-table">
                      <thead>
                        <tr>
                          <th scope="col">Captured</th>
                          <th scope="col">Solicited</th>
                          <th scope="col">Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSnapshots.map((snapshot) => (
                          <tr key={snapshot.id}>
                            <td>{formatDate(snapshot.capturedAt)}</td>
                            <td>{snapshot.countSolicited ?? '—'}</td>
                            <td>{snapshot.source ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  <form className="snapshot-form" onSubmit={handleSnapshotSubmit}>
                    <div className="form-row-inline">
                      <div className="form-row">
                        <label htmlFor="snapshot-count">Solicited count</label>
                        <input
                          id="snapshot-count"
                          type="number"
                          min={1}
                          inputMode="numeric"
                          value={snapshotForm.count}
                          onChange={(event) =>
                            setSnapshotForm((current) => ({
                              ...current,
                              count: event.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                      <div className="form-row">
                        <label htmlFor="snapshot-source">Source (optional)</label>
                        <input
                          id="snapshot-source"
                          type="text"
                          value={snapshotForm.source}
                          onChange={(event) =>
                            setSnapshotForm((current) => ({
                              ...current,
                              source: event.target.value,
                            }))
                          }
                          placeholder="Mailchimp audience, DM lot, etc."
                        />
                      </div>
                      <div className="form-row">
                        <label htmlFor="snapshot-captured">Captured at (optional)</label>
                        <input
                          id="snapshot-captured"
                          type="datetime-local"
                          value={snapshotForm.capturedAt}
                          onChange={(event) =>
                            setSnapshotForm((current) => ({
                              ...current,
                              capturedAt: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    {snapshotError ? (
                      <div className="form-alert form-alert-error">{snapshotError}</div>
                    ) : null}
                    <div className="form-actions">
                      <button type="submit" disabled={snapshotStatus === 'saving'}>
                        {snapshotStatus === 'saving' ? 'Logging…' : 'Log solicitation'}
                      </button>
                    </div>
                  </form>
                </div>
              </>
            ) : (
              <div className="appeals-state">Select an appeal to view details.</div>
            )}
          </div>
        </div>
      )}

      {isCreateOpen ? (
        <AppealForm
          title="Create appeal"
          submitLabel="Create appeal"
          pendingLabel="Saving…"
          formState={createForm}
          isSubmitting={createStatus === 'saving'}
          error={createError}
          idPrefix="create"
          onChange={(changes) =>
            setCreateForm((current) => ({
              ...current,
              ...changes,
            }))
          }
          onCancel={() => {
            setIsCreateOpen(false);
            setCreateError(null);
            setCreateForm(createEmptyAppealForm());
          }}
          onSubmit={handleCreateSubmit}
        />
      ) : null}

      {isEditOpen && selectedAppeal ? (
        <AppealForm
          title="Edit appeal"
          submitLabel="Update appeal"
          pendingLabel="Updating…"
          formState={editForm}
          isSubmitting={editStatus === 'saving'}
          error={editError}
          idPrefix="edit"
          onChange={(changes) =>
            setEditForm((current) => ({
              ...current,
              ...changes,
            }))
          }
          onCancel={() => {
            setIsEditOpen(false);
            setEditError(null);
            setEditForm(selectedAppeal ? mapAppealToForm(selectedAppeal) : createEmptyAppealForm());
          }}
          onSubmit={handleEditSubmit}
        />
      ) : null}
    </section>
  );
}
