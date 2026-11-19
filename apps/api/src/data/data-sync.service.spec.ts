import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DataSyncService,
  decryptSnapshot,
  encryptSnapshot,
} from './data-sync.service';

describe('DataSyncService', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'subsync-enc-sync-'));

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('encrypts and decrypts snapshots with AES-256-GCM and rejects wrong passphrases', () => {
    const raw = JSON.stringify({ hello: 'subsync' });
    const enc = encryptSnapshot(raw, 'correct-horse-battery');
    expect(decryptSnapshot(enc, 'correct-horse-battery')).toBe(raw);
    expect(() => decryptSnapshot(enc, 'wrong-passphrase')).toThrow();
  });

  it('pushes and pulls an encrypted snapshot via a local sync folder', async () => {
    const upsertedSubs: unknown[] = [];
    const prisma = {
      $transaction: jest.fn((cb) => cb(prisma)),
      userSettings: {
        findUnique: jest.fn().mockResolvedValue({ syncFolderPath: tempDir }),
      },
      service: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'svc_custom_linear',
            name: 'Linear',
            category: 'saas',
            supportsOAuth: false,
            isCustom: true,
            description: null,
            logoUrl: null,
            cancelUrl: null,
          },
        ]),
        upsert: jest.fn().mockResolvedValue({}),
      },
      subscription: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'sub_linear',
            serviceId: 'svc_custom_linear',
            planName: 'Basic',
            status: 'active',
            billingAmountCents: 1000,
            billingCurrency: 'USD',
            billingInterval: 'monthly',
            customIntervalDays: null,
            nextRenewal: new Date('2026-12-01T00:00:00.000Z'),
            trialEndsAt: null,
            postTrialAmountCents: null,
            leadTimeDaysOverride: null,
            tagsJson: '["work"]',
            totalSeats: null,
            sharedSeats: null,
            personalShareCents: null,
            bundleParentId: null,
            paymentSource: 'card',
            paymentLast4: '4242',
            autoImportSource: 'manual',
            notes: null,
            statusChangedAt: new Date('2026-11-19T00:00:00.000Z'),
          },
        ]),
        upsert: jest.fn().mockImplementation((arg) => {
          upsertedSubs.push(arg);
          return Promise.resolve({});
        }),
      },
      exchangeRate: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };

    const syncService = new DataSyncService(prisma as unknown as PrismaService);

    const pushRes = await syncService.pushToSyncFolder('secret-passphrase');
    expect(pushRes.subscriptionsCount).toBe(1);
    expect(pushRes.filePath).toContain('subsync-sync.enc');

    await expect(
      syncService.pullFromSyncFolder('bad-passphrase'),
    ).rejects.toThrow(BadRequestException);

    const pullRes = await syncService.pullFromSyncFolder('secret-passphrase');
    expect(pullRes.subscriptionsCount).toBe(1);
    expect(upsertedSubs).toHaveLength(1);
  });
});
