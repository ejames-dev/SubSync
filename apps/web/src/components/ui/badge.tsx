import * as React from 'react';
import { cn } from '../../lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'warning' | 'success';
}

export const Badge = ({
  variant = 'default',
  className,
  ...props
}: BadgeProps) => {
  const styles = {
    default:
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    warning:
      'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
    success:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  }[variant];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        styles,
        className,
      )}
      {...props}
    />
  );
};
