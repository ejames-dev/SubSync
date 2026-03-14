'use client';

import { NotificationPreference } from '@subscription-tracker/types';
import { FormEvent, useState } from 'react';
import { Button } from './ui/button';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

interface Props {
  preference: NotificationPreference;
}

export function NotificationPreferenceForm({ preference }: Props) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  );
  const [error, setError] = useState<string | null>(null);

  if (!API_BASE) {
    return <p className="text-sm text-red-600">NEXT_PUBLIC_API_URL missing.</p>;
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('saving');
    setError(null);

    const formData = new FormData(event.currentTarget);
    const channels: Array<'email' | 'push'> = [];
    if (formData.get('channel-email')) channels.push('email');
    if (formData.get('channel-push')) channels.push('push');

    try {
      const response = await fetch(`${API_BASE}/notifications/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadTimeDays: Number(formData.get('leadTimeDays')),
          channels: channels.length ? channels : ['email'],
        }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setStatus('saved');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="text-sm font-medium text-slate-700">
        Days before renewal
        <input
          type="number"
          name="leadTimeDays"
          min={1}
          max={30}
          defaultValue={preference.leadTimeDays}
          className="mt-1 w-32 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            name="channel-email"
            defaultChecked={preference.channels.includes('email')}
          />
          Email
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            name="channel-push"
            defaultChecked={preference.channels.includes('push')}
          />
          Push
        </label>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={status === 'saving'}>
          {status === 'saving' ? 'Saving…' : 'Save preferences'}
        </Button>
        {status === 'saved' && (
          <span className="text-sm text-emerald-600">Saved</span>
        )}
      </div>
    </form>
  );
}
