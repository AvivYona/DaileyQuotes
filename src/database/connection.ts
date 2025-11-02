import mongoose from 'mongoose';
import { databaseConfig } from '../config/database.config';

let connectionPromise: Promise<typeof mongoose> | null = null;

export const connectToDatabase = async (): Promise<typeof mongoose> => {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(databaseConfig.uri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 5,
    });

    mongoose.connection.on('error', (error) => {
      console.error('MongoDB connection error:', error);
    });
  }

  await connectionPromise;
  return mongoose;
};
