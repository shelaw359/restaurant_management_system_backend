import { IsString, IsNumber, IsNotEmpty, Matches } from 'class-validator';

export class InitiateSTKPushDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^254[0-9]{9}$/, {
    message: 'Phone number must be in format 254XXXXXXXXX',
  })
  phone_number: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsNotEmpty()
  account_reference: string; // e.g., "ORDER-123" or "TABLE-5"

  @IsString()
  @IsNotEmpty()
  transaction_desc: string; // e.g., "Payment for Order 123"
}

export class MpesaCallbackDto {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value: any;
        }>;
      };
    };
  };
}
