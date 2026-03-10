import * as React from 'react';
import { cn } from '../../lib/utils';

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('rounded-xl border border-slate-200 bg-white p-4 shadow-sm', className)}
    {...props}
  />
));
Card.displayName = 'Card';

export const CardHeader = (
  props: React.HTMLAttributes<HTMLDivElement>,
) => <div className={cn('mb-3', props.className)} {...props} />;

export const CardTitle = (
  props: React.HTMLAttributes<HTMLHeadingElement>,
) => <h3 className={cn('text-base font-semibold text-slate-900', props.className)} {...props} />;

export const CardContent = (
  props: React.HTMLAttributes<HTMLDivElement>,
) => <div className={cn('text-sm text-slate-600', props.className)} {...props} />;
