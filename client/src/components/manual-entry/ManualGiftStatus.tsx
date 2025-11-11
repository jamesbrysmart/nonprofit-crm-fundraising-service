interface ManualGiftStatusProps {
  status:
    | { state: 'idle' }
    | { state: 'submitting' }
    | { state: 'error'; message: string }
    | { state: 'success'; message: string; link?: string };
  isSubmitDisabled: boolean;
  showDuplicates: boolean;
}

export function ManualGiftStatus({
  status,
  isSubmitDisabled,
  showDuplicates,
}: ManualGiftStatusProps): JSX.Element {
  const isSubmitting = status.state === 'submitting';
  return (
    <>
      {status.state === 'error' ? (
        <div className="form-alert form-alert-error" role="alert">
          {status.message}
        </div>
      ) : null}

      {status.state === 'success' ? (
        <div className="form-alert form-alert-success" role="status">
          {status.message}
          {status.link ? (
            <a href={status.link} className="form-alert-link">
              Open gifts list
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="form-actions">
        <button type="submit" disabled={isSubmitDisabled || isSubmitting || showDuplicates}>
          {isSubmitting ? 'Saving…' : 'Create gift'}
        </button>
      </div>
    </>
  );
}
