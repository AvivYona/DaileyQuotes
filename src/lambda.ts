import {
  Context,
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Handler } from 'aws-lambda';
import serverlessExpress from '@vendia/serverless-express';
import * as express from 'express';

let cachedHandler:
  | Handler<APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2>
  | undefined;

async function bootstrapServer(): Promise<
  Handler<APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2>
> {
  if (!cachedHandler) {
    const expressApp = express();
    const nestApp = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
      {
        logger: ['error', 'warn', 'log', 'debug', 'verbose'],
      },
    );

    nestApp.enableShutdownHooks();
    await nestApp.init();

    cachedHandler = serverlessExpress<APIGatewayProxyEventV2>({
      app: expressApp,
    });
  }

  return cachedHandler;
}

export const handler: Handler<
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2
> = async (event, context: Context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const server = await bootstrapServer();
  return server(event, context);
};
