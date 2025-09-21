import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { databaseConfig } from './config/database.config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Memory monitoring
  const logMemoryUsage = () => {
    const used = process.memoryUsage();
    logger.log(
      `Memory Usage: RSS: ${Math.round(used.rss / 1024 / 1024)}MB, Heap Used: ${Math.round(used.heapUsed / 1024 / 1024)}MB, Heap Total: ${Math.round(used.heapTotal / 1024 / 1024)}MB`,
    );
  };

  // Log memory usage every 30 seconds
  setInterval(logMemoryUsage, 30000);
  logMemoryUsage(); // Log initial memory usage

  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors();

  // Add request logging middleware
  app.use((req, res, next) => {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logger.log(
        `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms - ${req.ip}`,
      );
    });

    next();
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(databaseConfig.port);
  logger.log(
    `Application is running on: http://localhost:${databaseConfig.port}`,
  );
}
bootstrap();
