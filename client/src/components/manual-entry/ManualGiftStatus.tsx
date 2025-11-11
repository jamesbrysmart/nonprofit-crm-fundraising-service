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
        <div className="f-alert f-alert--error" role="alert">
          {status.message}
        </div>
      ) : null}

      {status.state === 'success' ? (
        <div className="f-alert f-alert--success f-flex f-flex-wrap f-gap-2 f-items-center" role="status">
          {status.message}
          {status.link ? (
            <a href={status.link} className="f-text-primary f-font-semibold underline">
              Open gifts list
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="f-flex f-justify-end">
        <button
          type="submit"
          className="f-btn--primary"
          disabled={isSubmitDisabled || isSubmitting || showDuplicates}
        >
          {isSubmitting ? 'Saving…' : 'Create gift'}
        </button>
      </div>
    </>
  );
}
