export type StagingStatusTone = 'info' | 'success' | 'warning' | 'danger';

export function statusToneClass(tone: StagingStatusTone): string {
  switch (tone) {
    case 'success':
      return 'f-pill-status--success';
    case 'warning':
      return 'f-pill-status--warning';
    case 'danger':
      return 'f-pill-status--danger';
    default:
      return 'f-pill-status--info';
  }
}
