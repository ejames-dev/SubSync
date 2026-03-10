import { PrismaClient } from './generated/client';
import { STREAMING_SERVICES } from '../src/service-catalog/service-catalog.data';

const prisma = new PrismaClient();

async function main() {
  for (const service of STREAMING_SERVICES) {
    await prisma.service.upsert({
      where: { id: service.id },
      update: {
        name: service.name,
        category: service.category,
        supportsOAuth: service.supportsOAuth,
        description: service.description,
      },
      create: {
        id: service.id,
        name: service.name,
        category: service.category,
        supportsOAuth: service.supportsOAuth,
        description: service.description,
      },
    });
  }
}

main()
  .catch((err) => {
    console.error('Seed failed', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
