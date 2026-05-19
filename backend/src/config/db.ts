import mongoose from 'mongoose';

import env from './env';

export const connectDatabase = async (): Promise<void> => {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI, {
    autoIndex: env.NODE_ENV !== 'production',
    serverSelectionTimeoutMS: 5000,
  });
  console.log('INFO | MongoDB connection established.');
};

export const disconnectDatabase = async (): Promise<void> => {
  await mongoose.disconnect();
  console.log('INFO | MongoDB connection closed.');
};
