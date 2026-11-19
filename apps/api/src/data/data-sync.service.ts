import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { BadRequestException, Injectable } from '@nestjs/common';
import { EncryptedSyncResult } from '@subscription-tracker/types';
import { PrismaService } from '../prisma/prisma.service';

const MAGIC_HEADER = 'SUBSYNC_ENC_V1';
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const SYNC_FILENAME = 'subsync-sync.enc';

interface PortableStateSnapshot {
  version: number;
  exportedAt: string;
  services: Array<{
    id: string;
    name: string;
    category: string;
    supportsOAuth: boolean;
    isCustom: boolean;
    description: string | null;
    logoUrl: string | null;
    cancelUrl: string | null;
  }>;
  subscriptions: Array<{
    id: string;
    serviceId: string;
    planName: string;
    status: string;
    billingAmountCents: number;
    billingCurrency: string;
    billingInterval: string;
    customIntervalDays: number | null;
    nextRenewal: string;
    trialEndsAt: string | null;
    postTrialAmountCents: number | null;
    leadTimeDaysOverride: number | null;
    tagsJson: string | null;
    totalSeats: number | null;
    sharedSeats: number | null;
    personalShareCents: number | null;
    bundleParentId: string | null;
    paymentSource: string | null;
    paymentLast4: string | null;
    autoImportSource: string | null;
    notes: string | null;
    statusChangedAt: string;
  }>;
  exchangeRates: Array<{
    currency: string;
    rateToUsd: number;
    isManualOverride: boolean;
  }>;
}

@Injectable()
export class DataSyncService {
  constructor(private readonly prisma: PrismaService) {}

  async exportEncryptedBuffer(passphrase: string): Promise<Buffer> {
    this.assertPassphrase(passphrase);
    const snapshot = await this.captureSnapshot();
    return encryptSnapshot(JSON.stringify(snapshot), passphrase);
  }

  async importEncryptedBuffer(
    encrypted: Buffer,
    passphrase: string,
  ): Promise<EncryptedSyncResult> {
    this.assertPassphrase(passphrase);
    let snapshot: PortableStateSnapshot;
    try {
      const plaintext = decryptSnapshot(encrypted, passphrase);
      snapshot = JSON.parse(plaintext) as PortableStateSnapshot;
    } catch {
      throw new BadRequestException(
        'Could not decrypt sync snapshot. Check your passphrase and file.',
      );
    }

    if (
      !snapshot ||
      !Array.isArray(snapshot.services) ||
      !Array.isArray(snapshot.subscriptions)
    ) {
      throw new BadRequestException('Invalid sync snapshot structure.');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const svc of snapshot.services) {
        await tx.service.upsert({
          where: { id: svc.id },
          update: {
            name: svc.name,
            category: svc.category,
            supportsOAuth: svc.supportsOAuth,
            isCustom: svc.isCustom,
            description: svc.description,
            logoUrl: svc.logoUrl,
            cancelUrl: svc.cancelUrl,
          },
          create: {
            id: svc.id,
            name: svc.name,
            category: svc.category,
            supportsOAuth: svc.supportsOAuth,
            isCustom: svc.isCustom,
            description: svc.description,
            logoUrl: svc.logoUrl,
            cancelUrl: svc.cancelUrl,
          },
        });
      }

      for (const sub of snapshot.subscriptions) {
        await tx.subscription.upsert({
          where: { id: sub.id },
          update: {
            serviceId: sub.serviceId,
            planName: sub.planName,
            status: sub.status,
            billingAmountCents: sub.billingAmountCents,
            billingCurrency: sub.billingCurrency,
            billingInterval: sub.billingInterval,
            customIntervalDays: sub.customIntervalDays,
            nextRenewal: new Date(sub.nextRenewal),
            trialEndsAt: sub.trialEndsAt ? new Date(sub.trialEndsAt) : null,
            postTrialAmountCents: sub.postTrialAmountCents,
            leadTimeDaysOverride: sub.leadTimeDaysOverride,
            tagsJson: sub.tagsJson,
            totalSeats: sub.totalSeats,
            sharedSeats: sub.sharedSeats,
            personalShareCents: sub.personalShareCents,
            bundleParentId: sub.bundleParentId,
            paymentSource: sub.paymentSource,
            paymentLast4: sub.paymentLast4,
            autoImportSource: sub.autoImportSource,
            notes: sub.notes,
            statusChangedAt: new Date(sub.statusChangedAt),
          },
          create: {
            id: sub.id,
            serviceId: sub.serviceId,
            planName: sub.planName,
            status: sub.status,
            billingAmountCents: sub.billingAmountCents,
            billingCurrency: sub.billingCurrency,
            billingInterval: sub.billingInterval,
            customIntervalDays: sub.customIntervalDays,
            nextRenewal: new Date(sub.nextRenewal),
            trialEndsAt: sub.trialEndsAt ? new Date(sub.trialEndsAt) : null,
            postTrialAmountCents: sub.postTrialAmountCents,
            leadTimeDaysOverride: sub.leadTimeDaysOverride,
            tagsJson: sub.tagsJson,
            totalSeats: sub.totalSeats,
            sharedSeats: sub.sharedSeats,
            personalShareCents: sub.personalShareCents,
            bundleParentId: sub.bundleParentId,
            paymentSource: sub.paymentSource,
            paymentLast4: sub.paymentLast4,
            autoImportSource: sub.autoImportSource,
            notes: sub.notes,
            statusChangedAt: new Date(sub.statusChangedAt),
          },
        });
      }

      for (const rate of snapshot.exchangeRates ?? []) {
        await tx.exchangeRate.upsert({
          where: { currency: rate.currency },
          update: {
            rateToUsd: rate.rateToUsd,
            isManualOverride: rate.isManualOverride,
          },
          create: {
            currency: rate.currency,
            rateToUsd: rate.rateToUsd,
            isManualOverride: rate.isManualOverride,
          },
        });
      }
    });

    const syncedAt = new Date().toISOString();
    return {
      syncedAt,
      subscriptionsCount: snapshot.subscriptions.length,
      servicesCount: snapshot.services.length,
      message: `Merged ${snapshot.subscriptions.length} subscriptions from encrypted snapshot.`,
    };
  }

  async pushToSyncFolder(
    passphrase: string,
    folderOverride?: string,
  ): Promise<EncryptedSyncResult> {
    const folder = await this.resolveSyncFolder(folderOverride);
    const snapshot = await this.captureSnapshot();
    const encrypted = encryptSnapshot(JSON.stringify(snapshot), passphrase);
    mkdirSync(folder, { recursive: true });
    const filePath = join(folder, SYNC_FILENAME);
    writeFileSync(filePath, encrypted);

    return {
      filePath,
      syncedAt: new Date().toISOString(),
      subscriptionsCount: snapshot.subscriptions.length,
      servicesCount: snapshot.services.length,
      message: `Wrote encrypted sync snapshot to ${filePath}.`,
    };
  }

  async pullFromSyncFolder(
    passphrase: string,
    folderOverride?: string,
  ): Promise<EncryptedSyncResult> {
    const folder = await this.resolveSyncFolder(folderOverride);
    const filePath = join(folder, SYNC_FILENAME);
    if (!existsSync(filePath)) {
      throw new BadRequestException(
        `No encrypted sync snapshot found at ${filePath}.`,
      );
    }
    const encrypted = readFileSync(filePath);
    const res = await this.importEncryptedBuffer(encrypted, passphrase);
    return { ...res, filePath };
  }

  private async resolveSyncFolder(override?: string): Promise<string> {
    if (override?.trim()) {
      return resolve(override.trim());
    }
    const settings = await this.prisma.userSettings.findUnique({
      where: { id: 'default' },
    });
    if (!settings?.syncFolderPath?.trim()) {
      throw new BadRequestException(
        'Configure a sync folder path in Settings first.',
      );
    }
    return resolve(settings.syncFolderPath.trim());
  }

  private assertPassphrase(passphrase: string): void {
    if (!passphrase || passphrase.trim().length < 6) {
      throw new BadRequestException(
        'Encryption passphrase must be at least 6 characters.',
      );
    }
  }

  private async captureSnapshot(): Promise<PortableStateSnapshot> {
    const [services, subscriptions, exchangeRates] = await Promise.all([
      this.prisma.service.findMany(),
      this.prisma.subscription.findMany(),
      this.prisma.exchangeRate.findMany(),
    ]);

    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        supportsOAuth: s.supportsOAuth,
        isCustom: s.isCustom,
        description: s.description,
        logoUrl: s.logoUrl,
        cancelUrl: s.cancelUrl,
      })),
      subscriptions: subscriptions.map((sub) => ({
        id: sub.id,
        serviceId: sub.serviceId,
        planName: sub.planName,
        status: sub.status,
        billingAmountCents: sub.billingAmountCents,
        billingCurrency: sub.billingCurrency,
        billingInterval: sub.billingInterval,
        customIntervalDays: sub.customIntervalDays,
        nextRenewal: sub.nextRenewal.toISOString(),
        trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
        postTrialAmountCents: sub.postTrialAmountCents,
        leadTimeDaysOverride: sub.leadTimeDaysOverride,
        tagsJson: sub.tagsJson,
        totalSeats: sub.totalSeats,
        sharedSeats: sub.sharedSeats,
        personalShareCents: sub.personalShareCents,
        bundleParentId: sub.bundleParentId,
        paymentSource: sub.paymentSource,
        paymentLast4: sub.paymentLast4,
        autoImportSource: sub.autoImportSource,
        notes: sub.notes,
        statusChangedAt: sub.statusChangedAt.toISOString(),
      })),
      exchangeRates: exchangeRates.map((r) => ({
        currency: r.currency,
        rateToUsd: r.rateToUsd,
        isManualOverride: r.isManualOverride,
      })),
    };
  }
}

export function encryptSnapshot(plaintext: string, passphrase: string): Buffer {
  const header = Buffer.from(`${MAGIC_HEADER}\n`, 'utf8');
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = scryptSync(passphrase, salt, 32);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([header, salt, iv, tag, ciphertext]);
}

export function decryptSnapshot(payload: Buffer, passphrase: string): string {
  const header = Buffer.from(`${MAGIC_HEADER}\n`, 'utf8');
  if (
    payload.length < header.length + SALT_LEN + IV_LEN + TAG_LEN ||
    !payload.subarray(0, header.length).equals(header)
  ) {
    throw new Error('Invalid snapshot header.');
  }
  let offset = header.length;
  const salt = payload.subarray(offset, offset + SALT_LEN);
  offset += SALT_LEN;
  const iv = payload.subarray(offset, offset + IV_LEN);
  offset += IV_LEN;
  const tag = payload.subarray(offset, offset + TAG_LEN);
  offset += TAG_LEN;
  const ciphertext = payload.subarray(offset);

  const key = scryptSync(passphrase, salt, 32);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}
