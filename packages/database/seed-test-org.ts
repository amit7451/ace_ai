import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const testEmails = ['test@ion-ai.com', 'test1@ion-ai.com', 'test@ion.ai'];
  const testUsers = await prisma.user.findMany({
    where: { email: { in: testEmails } },
  });

  if (testUsers.length === 0) {
    console.log('No test users found.');
    return;
  }

  // Create a testing organization
  const org = await prisma.organization.create({
    data: {
      name: 'Testing Organization',
      slug: 'testing-organization-' + Date.now(),
      configuration: {
        create: {
          llmProvider: 'openai',
          embeddingProvider: 'openai',
          systemPrompt: 'You are a test assistant.',
        },
      },
    },
  });

  console.log(`Created Testing Organization with ID: ${org.id}`);

  // Attach all test users to this organization as OWNERs
  for (const user of testUsers) {
    await prisma.organizationMember.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    console.log(`Attached ${user.email} to Testing Organization as OWNER.`);
  }

  console.log('Done.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
