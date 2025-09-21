import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not set');
}

export const databaseConfig = {
  uri: process.env.MONGODB_URI,
  port: process.env.PORT || 3000,
};
