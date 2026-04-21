import { cn } from "@/lib/utils";

interface PageBandProps extends React.HTMLAttributes<HTMLElement> {
  tone?: "default" | "muted" | "contrast";
  innerClassName?: string;
}

export function PageBand({
  className,
  innerClassName,
  tone = "default",
  children,
  ...props
}: PageBandProps) {
  return (
    <section
      className={cn(
        "page-band page-band--bleed",
        tone === "muted" && "page-band--muted",
        tone === "contrast" && "page-band--contrast",
        className,
      )}
      {...props}
    >
      <div className={cn("page-band__inner", innerClassName)}>{children}</div>
    </section>
  );
}
