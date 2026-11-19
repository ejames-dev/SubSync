import { buildWebhookPayload } from './outbound-alert.service';

describe('OutboundAlertService helpers', () => {
  it('formats webhook payloads for Discord, Slack, and generic/ntfy endpoints', () => {
    const msg = {
      title: 'Netflix renews soon',
      body: 'Standard renews on Dec 1 for USD 15.49.',
      subscriptionId: 'sub_1',
    };

    expect(
      buildWebhookPayload('https://discord.com/api/webhooks/123/abc', msg),
    ).toEqual({
      content:
        '**Netflix renews soon**\nStandard renews on Dec 1 for USD 15.49.',
    });

    expect(
      buildWebhookPayload('https://hooks.slack.com/services/T00/B00/XX', msg),
    ).toEqual({
      text: '*Netflix renews soon*\nStandard renews on Dec 1 for USD 15.49.',
    });

    expect(buildWebhookPayload('https://ntfy.sh/subsync-alerts', msg)).toEqual(
      expect.objectContaining({
        title: 'Netflix renews soon',
        message: 'Standard renews on Dec 1 for USD 15.49.',
        subscriptionId: 'sub_1',
      }),
    );
  });
});
