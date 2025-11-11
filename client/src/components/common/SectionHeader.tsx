interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
}

export function SectionHeader({ eyebrow, title, description }: SectionHeaderProps): JSX.Element {
  return (
    <div>
      <p className="f-text-xs f-uppercase f-tracking-[0.08em] f-text-slate-500 f-m-0">{eyebrow}</p>
      <h3 className="f-text-xl f-font-semibold f-text-ink f-mt-1 f-mb-0">{title}</h3>
      {description ? <p className="small-text f-mt-1">{description}</p> : null}
    </div>
  );
}
