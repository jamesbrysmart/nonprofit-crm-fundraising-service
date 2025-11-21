import { Module } from '@nestjs/common';
import { ReceiptPolicyService } from './receipt-policy.service';

@Module({
  providers: [ReceiptPolicyService],
  exports: [ReceiptPolicyService],
})
export class ReceiptModule {}
