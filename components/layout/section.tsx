import { cn } from "@/lib/utils";

interface SectionProps {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function Section({
  id,
  eyebrow,
  title,
  description,
  action,
  className,
  children,
}: SectionProps) {
  return (
    <section id={id} className={cn("scroll-mt-24", className)}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="max-w-xl">
          {eyebrow && <p className="label-xs mb-2">{eyebrow}</p>}
          <h2 className="font-heading text-xl font-semibold tracking-[-0.02em] sm:text-[1.375rem]">
            {title}
          </h2>
          {description && (
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
