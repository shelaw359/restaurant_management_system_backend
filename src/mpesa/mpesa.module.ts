import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MpesaController } from './mpesa.controller';
import { MpesaService } from './mpesa.service';

@Module({
  imports: [HttpModule],
  controllers: [MpesaController],
  providers: [MpesaService],
  exports: [MpesaService],
})
export class MpesaModule {}