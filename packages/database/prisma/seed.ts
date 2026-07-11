import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'test@ion.ai';
  const passwordHash = await hash('password123', 10);

  // Upsert the test user
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'Test User',
      passwordHash,
    },
  });

  // Create an organization if they don't have one
  let member = await prisma.organizationMember.findFirst({
    where: { userId: user.id },
  });

  if (!member) {
    const org = await prisma.organization.create({
      data: {
        name: 'Test Organization',
        slug: 'test-organization-' + Math.random().toString(36).substring(7),
      },
    });

    await prisma.organizationMember.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });

    console.log(`Created Organization: ${org.id}`);
  }

  console.log(`User seeded: ${user.email} (Password: password123)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
