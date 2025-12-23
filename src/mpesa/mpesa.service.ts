import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { InitiateSTKPushDto, MpesaCallbackDto } from './dto/mpesa.dto';

@Injectable()
export class MpesaService {
  private readonly logger = new Logger(MpesaService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const environment = this.configService.get('MPESA_ENVIRONMENT', 'sandbox');
    this.baseUrl =
      environment === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke';
    
    this.logger.log(`M-Pesa Service initialized in ${environment} mode`);
    this.logger.log(`Base URL: ${this.baseUrl}`);
  }

  /**
   * Generate OAuth Access Token
   */
  async generateAccessToken(): Promise<string> {
    const consumerKey = this.configService.get('MPESA_CONSUMER_KEY');
    const consumerSecret = this.configService.get('MPESA_CONSUMER_SECRET');

    this.logger.log(`Consumer Key loaded: ${consumerKey ? consumerKey.substring(0, 10) + '...' : 'NOT FOUND'}`);
    this.logger.log(`Consumer Secret loaded: ${consumerSecret ? consumerSecret.substring(0, 10) + '...' : 'NOT FOUND'}`);

    if (!consumerKey || !consumerSecret) {
      this.logger.error('M-Pesa credentials not configured properly');
      throw new HttpException(
        'M-Pesa credentials not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const url = `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`;

    this.logger.log(`Requesting access token from: ${url}`);

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            Authorization: `Basic ${auth}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Cache-Control': 'no-cache',
          },
        }),
      );

      this.logger.log('Access token generated successfully');
      return response.data.access_token;
    } catch (error) {
      this.logger.error('Failed to generate access token');
      this.logger.error(`HTTP Status: ${error.response?.status}`);
      this.logger.error(`Status Text: ${error.response?.statusText}`);
      this.logger.error(`Error Code: ${error.response?.data?.errorCode}`);
      this.logger.error(`Error Message: ${error.response?.data?.errorMessage}`);
      this.logger.error(`Full Error: ${JSON.stringify(error.response?.data, null, 2)}`);
      
      throw new HttpException(
        error.response?.data?.errorMessage || 'Failed to authenticate with M-Pesa',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Generate Password for STK Push
   */
  private generatePassword(): { password: string; timestamp: string } {
    const shortcode = this.configService.get('MPESA_SHORTCODE');
    const passkey = this.configService.get('MPESA_PASSKEY');
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T.]/g, '')
      .slice(0, 14);

    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    this.logger.log(`Generated password for timestamp: ${timestamp}`);
    return { password, timestamp };
  }

  /**
   * Initiate STK Push
   */
  async initiateSTKPush(data: InitiateSTKPushDto) {
    this.logger.log(`Initiating STK Push for phone: ${data.phone_number}, amount: ${data.amount}`);
    
    const accessToken = await this.generateAccessToken();
    const { password, timestamp } = this.generatePassword();
    const shortcode = this.configService.get('MPESA_SHORTCODE');
    const callbackUrl = this.configService.get('MPESA_CALLBACK_URL');

    const payload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(data.amount),
      PartyA: data.phone_number,
      PartyB: shortcode,
      PhoneNumber: data.phone_number,
      CallBackURL: callbackUrl,
      AccountReference: data.account_reference.substring(0, 12),
      TransactionDesc: data.transaction_desc.substring(0, 13),
    };

    this.logger.log(`STK Push Payload: ${JSON.stringify({ ...payload, Password: 'HIDDEN' }, null, 2)}`);

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          },
        ),
      );

      this.logger.log(`STK Push initiated successfully: ${response.data.CheckoutRequestID}`);
      return {
        merchant_request_id: response.data.MerchantRequestID,
        checkout_request_id: response.data.CheckoutRequestID,
        response_code: response.data.ResponseCode,
        response_description: response.data.ResponseDescription,
        customer_message: response.data.CustomerMessage,
      };
    } catch (error) {
      this.logger.error('STK Push failed');
      this.logger.error(`HTTP Status: ${error.response?.status}`);
      this.logger.error(`Error Code: ${error.response?.data?.errorCode}`);
      this.logger.error(`Error Message: ${error.response?.data?.errorMessage}`);
      this.logger.error(`Full Error: ${JSON.stringify(error.response?.data, null, 2)}`);
      
      throw new HttpException(
        error.response?.data?.errorMessage || 'Failed to initiate payment',
        error.response?.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Query STK Push Transaction Status
   */
  async queryTransactionStatus(checkoutRequestId: string) {
    this.logger.log(`Querying transaction status for: ${checkoutRequestId}`);
    
    const accessToken = await this.generateAccessToken();
    const { password, timestamp } = this.generatePassword();
    const shortcode = this.configService.get('MPESA_SHORTCODE');

    const payload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/mpesa/stkpushquery/v1/query`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          },
        ),
      );

      this.logger.log(`Transaction status: ${response.data.ResultDesc}`);
      return {
        status: response.data.ResultCode === '0' ? 'completed' : 'failed',
        result_code: response.data.ResultCode,
        result_desc: response.data.ResultDesc,
        checkout_request_id: response.data.CheckoutRequestID,
      };
    } catch (error) {
      this.logger.error('Query failed');
      this.logger.error(`Error: ${JSON.stringify(error.response?.data, null, 2)}`);
      
      throw new HttpException(
        error.response?.data?.errorMessage || 'Failed to query transaction status',
        error.response?.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Process M-Pesa Callback
   */
  async processCallback(callbackData: MpesaCallbackDto) {
    const { stkCallback } = callbackData.Body;

    this.logger.log(`Processing callback for: ${stkCallback.CheckoutRequestID}`);
    this.logger.log(`Result Code: ${stkCallback.ResultCode}`);
    this.logger.log(`Result Description: ${stkCallback.ResultDesc}`);

    if (stkCallback.ResultCode === 0) {
      if (!stkCallback.CallbackMetadata) {
        this.logger.error('Missing callback metadata');
        throw new HttpException(
          'Missing callback metadata',
          HttpStatus.BAD_REQUEST,
        );
      }

      const metadata = stkCallback.CallbackMetadata.Item;
      const amount = metadata.find((item) => item.Name === 'Amount')?.Value;
      const mpesaReceiptNumber = metadata.find(
        (item) => item.Name === 'MpesaReceiptNumber',
      )?.Value;
      const phoneNumber = metadata.find((item) => item.Name === 'PhoneNumber')?.Value;
      const transactionDate = metadata.find(
        (item) => item.Name === 'TransactionDate',
      )?.Value;

      this.logger.log(`Payment successful - Receipt: ${mpesaReceiptNumber}, Amount: ${amount}`);
      
      return {
        success: true,
        receipt_number: mpesaReceiptNumber,
        amount,
        phone_number: phoneNumber,
        transaction_date: transactionDate,
      };
    } else {
      this.logger.warn(
        `Payment failed: ${stkCallback.ResultDesc} (Code: ${stkCallback.ResultCode})`,
      );

      return {
        success: false,
        error_message: stkCallback.ResultDesc,
        result_code: stkCallback.ResultCode,
      };
    }
  }
}