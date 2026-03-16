import dotenv from 'dotenv';

dotenv.config();

import { connectDatabase, disconnectDatabase } from '../config/db';
import logger from '../config/logger';
import { UserRole } from '../constants/roles';
import UserModel from '../models/User.model';

interface SeedArgs {
  fullName: string;
  email: string;
  password: string;
}

const getArgValue = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);

  if (index === -1 || index === process.argv.length - 1) {
    return undefined;
  }

  return process.argv[index + 1];
};

const parseArgs = (): SeedArgs => {
  const fullName = getArgValue('--fullName');
  const email = getArgValue('--email');
  const password = getArgValue('--password');

  if (!fullName || !email || !password) {
    throw new Error(
      'Usage: npm run seed:super-admin -- --fullName "System Admin" --email admin@example.com --password "StrongPass123!"',
    );
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  return {
    fullName: fullName.trim(),
    email: email.trim().toLowerCase(),
    password,
  };
};

const run = async (): Promise<void> => {
  const args = parseArgs();

  await connectDatabase();

  const existingUser = await UserModel.findOne({ email: args.email })
    .select('_id role')
    .lean();

  if (existingUser) {
    throw new Error(`A user with email ${args.email} already exists.`);
  }

  const totalUsers = await UserModel.countDocuments();

  if (totalUsers > 0) {
    logger.warn(
      'Users already exist in the system. This script will still create an additional super_admin.',
    );
  }

  const user = new UserModel({
    fullName: args.fullName,
    email: args.email,
    password: args.password,
    role: UserRole.SUPER_ADMIN,
    isActive: true,
    createdBy: null,
  });

  await user.save();

  logger.info(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    'Super admin user created successfully.',
  );
};

void run()
  .catch((error: unknown) => {
    logger.error({ err: error }, 'Failed to seed super admin.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
