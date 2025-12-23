import { Controller, Post, Get, Body, Param, Logger } from '@nestjs/common';
import { MpesaService } from './mpesa.service';
import { InitiateSTKPushDto, MpesaCallbackDto } from './dto/mpesa.dto';

@Controller('mpesa')
export class MpesaController {
  private readonly logger = new Logger(MpesaController.name);

  constructor(private readonly mpesaService: MpesaService) {}

  /**
   * Initiate STK Push Payment
   * POST /api/mpesa/stk-push
   */
  @Post('stk-push')
  async initiatePayment(@Body() data: InitiateSTKPushDto) {
    this.logger.log(`Initiating payment for ${data.phone_number}`);
    return await this.mpesaService.initiateSTKPush(data);
  }

  /**
   * M-Pesa Callback Endpoint
   * POST /api/mpesa/callback
   * This is called by Safaricom when payment completes
   */
  @Post('callback')
  async handleCallback(@Body() callbackData: MpesaCallbackDto) {
    this.logger.log('Received M-Pesa callback');
    const result = await this.mpesaService.processCallback(callbackData);
    
    // M-Pesa expects a 200 response
    return {
      ResultCode: 0,
      ResultDesc: 'Success',
    };
  }

  /**
   * Query Transaction Status
   * GET /api/mpesa/transaction-status/:checkoutRequestId
   */
  @Get('transaction-status/:checkoutRequestId')
  async queryStatus(@Param('checkoutRequestId') checkoutRequestId: string) {
    return await this.mpesaService.queryTransactionStatus(checkoutRequestId);
  }

  /**
   * Test endpoint to verify setup
   * GET /api/mpesa/test
   */
  @Get('test')
  async test() {
    return {
      message: 'M-Pesa integration is ready',
      environment: process.env.MPESA_ENVIRONMENT || 'sandbox',
    };
  }
}
