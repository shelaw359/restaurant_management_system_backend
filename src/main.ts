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

  // ✅✅✅ COMPLETE CORS FIX - NO EXTERNAL PACKAGE NEEDED ✅✅✅
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    exposedHeaders: ['Authorization'],
    credentials: true,
    optionsSuccessStatus: 200,
  });

  // ✅ ADD THIS MIDDLEWARE FOR PREFLIGHT REQUESTS
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Handle OPTIONS (preflight) requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    next();
  });
  // ✅✅✅ END OF CORS FIX ✅✅✅

  // Enable validation with proper settings for type transformation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // Enable automatic transformation
      whitelist: true, // Strip properties without decorators
      forbidNonWhitelisted: false, // Changed to false to avoid blocking valid requests
      transformOptions: {
        enableImplicitConversion: true, // Enable implicit type conversion
      },
      // Add these for better error messages
      disableErrorMessages: false,
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

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

  const port = configService.get('PORT') || 4000; // ⬅️ CHANGED HERE: 3000 → 4000
  
  await app.listen(port);

  // Success messages
  logger.log(`✅ Application running on: http://localhost:${port}`);
  logger.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
  logger.log(`🗄️  Database: ${configService.get('DB_NAME')} @ ${configService.get('DB_HOST')}`);
  logger.log(`🌐 CORS enabled for: ALL ORIGINS (*)`);
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

bootstrap().catch((error) => {
  console.error('❌ Bootstrap error:', error);
  process.exit(1);
});