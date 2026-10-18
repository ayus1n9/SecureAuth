import dotenv from 'dotenv';
dotenv.config();

import { prisma, disconnectDb } from './db.js';
import { hashPassword } from '../auth/password.js';
import { logger } from '../logging/logger.js';

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    logger.error('Database seeding is strictly disabled in production environments');
    process.exit(1);
  }

  logger.info('Starting local development database seed...');

  // Clean existing development data safely
  await prisma.auditEvent.deleteMany({});
  await prisma.record.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});

  const testPassword = 'Password123!@#';
  const hashedPassword = await hashPassword(testPassword);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@secureauth.local',
      fullName: 'Security Admin',
      passwordHash: hashedPassword,
      role: 'ADMIN',
    },
  });

  const support = await prisma.user.create({
    data: {
      email: 'support@secureauth.local',
      fullName: 'Helpdesk Support',
      passwordHash: hashedPassword,
      role: 'SUPPORT',
    },
  });

  const userA = await prisma.user.create({
    data: {
      email: 'alice@secureauth.local',
      fullName: 'Alice Walker',
      passwordHash: hashedPassword,
      role: 'USER',
    },
  });

  const userB = await prisma.user.create({
    data: {
      email: 'bob@secureauth.local',
      fullName: 'Bob Martin',
      passwordHash: hashedPassword,
      role: 'USER',
    },
  });

  // Create sample records for Alice and Bob to demonstrate ownership segregation
  await prisma.record.create({
    data: {
      title: "Alice's Secret Project Roadmap",
      content: 'Confidential strategy notes for Project Titan. Strictly access-controlled.',
      classification: 'CONFIDENTIAL',
      userId: userA.id,
    },
  });

  await prisma.record.create({
    data: {
      title: "Bob's Financial Budget Draft",
      content: 'Quarterly financial statements and expense estimates.',
      classification: 'RESTRICTED',
      userId: userB.id,
    },
  });

  logger.info({
    seeded: {
      admin: admin.email,
      support: support.email,
      userA: userA.email,
      userB: userB.email,
      defaultDevPassword: testPassword,
    },
  }, 'Development database successfully seeded');

  await disconnectDb();
}

seed().catch((err) => {
  logger.error({ err }, 'Seed script failed');
  process.exit(1);
});
