import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  shadow?: boolean;
  padding?: "sm" | "md" | "lg" | "none";
}

const paddings = {
  none: "",
  sm:   "p-4",
  md:   "p-[18px]",
  lg:   "p-[22px]",
};

function Card({ shadow = false, padding = "md", className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-petition border border-brand-border bg-brand-surface",
        paddings[padding],
        shadow && "shadow-petition",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-3", className)} {...props}>
      {children}
    </div>
  );
}

function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("font-display font-bold text-[16px] text-brand-ink leading-tight", className)}
      {...props}
    >
      {children}
    </h2>
  );
}

function CardBody({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("text-brand-ink", className)} {...props}>
      {children}
    </div>
  );
}

function CardFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-4 pt-4 border-t border-brand-border text-brand-muted text-[12px]", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { Card, CardHeader, CardTitle, CardBody, CardFooter };
export type { CardProps };
