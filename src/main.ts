import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  // Create the app
  const app = await NestFactory.create(AppModule);

  // Get ConfigService to verify configuration
  const configService = app.get(ConfigService);
  
  logger.log('=== Application Starting ===');
  logger.log(`Environment: ${configService.get('NODE_ENV')}`);
  logger.log(`Database: ${configService.get('DB_NAME')}`);
  logger.log(`Server: ${configService.get('DB_HOST')}:${configService.get('DB_PORT')}`);
  logger.log('============================');

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Enable CORS - FIXED
  app.enableCors({
    origin: '*', // Changed from 'true' to '*'
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  });

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Restaurant Management API')
    .setDescription('Restaurant POS System API Documentation')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  const port = configService.get('PORT') || 3000;
  
  await app.listen(port);

  // Success messages
  logger.log(` Application running on: http://localhost:${port}`);
  logger.log(` API Documentation: http://localhost:${port}/api/docs`);
  logger.log(` Database: ${configService.get('DB_NAME')} @ ${configService.get('DB_HOST')}`);
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

bootstrap().catch((error) => {
  console.error('Bootstrap error:', error);
  process.exit(1);
});