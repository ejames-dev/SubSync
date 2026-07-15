import { SubscriptionStatus } from '@subscription-tracker/types';
import { Badge } from './ui/badge';

const LABELS: Record<SubscriptionStatus, { label: string; variant: 'default' | 'warning' | 'success' }> = {
  active: { label: 'Active', variant: 'success' },
  trial: { label: 'Trial', variant: 'default' },
  flagged_for_cancellation: { label: 'Review to cancel', variant: 'warning' },
  canceled_pending: { label: 'Cancels soon', variant: 'warning' },
};

interface Props {
  status: SubscriptionStatus;
}

export function StatusBadge({ status }: Props) {
  const { label, variant } = LABELS[status];
  return <Badge variant={variant}>{label}</Badge>;
}
