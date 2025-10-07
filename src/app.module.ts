import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthorsModule } from './authors/authors.module';
import { QuotesModule } from './quotes/quotes.module';
import { BackgroundsModule } from './backgrounds/backgrounds.module';
import { databaseConfig } from './config/database.config';

@Module({
  imports: [
    MongooseModule.forRoot(databaseConfig.uri, {
      connectionFactory: (connection) => {
        connection.on('connected', () => {
          console.log('MongoDB connected successfully');
        });
        connection.on('error', (error) => {
          console.error('MongoDB connection error:', error);
        });
        return connection;
      },
    }),
    AuthorsModule,
    QuotesModule,
    BackgroundsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
