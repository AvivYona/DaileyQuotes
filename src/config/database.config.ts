import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const databaseConfig = {
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/daileyquotes',
  port: process.env.PORT || 3000,
};
