import type { ReactNode } from "react";

export function SectionHeading({
  index,
  eyebrow,
  title,
  children,
}: {
  index: string;
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-heading" data-reveal>
      <div>
        <span className="eyebrow">
          <span>{index} /</span> {eyebrow}
        </span>
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}
