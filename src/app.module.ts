import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GiftModule } from './gift/gift.module';
import { GiftStagingModule } from './gift-staging/gift-staging.module';
import { HealthController } from './health/health.controller';
import { LoggingModule } from './logging/logging.module';
import { PeopleModule } from './people/people.module';
import { TwentyModule } from './twenty/twenty.module';
import { StripeModule } from './stripe/stripe.module';
import { RecurringAgreementModule } from './recurring-agreement/recurring-agreement.module';
import { GoCardlessModule } from './gocardless/gocardless.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggingModule,
    TwentyModule,
    GiftModule,
    GiftStagingModule,
    PeopleModule,
    StripeModule,
    RecurringAgreementModule,
    GoCardlessModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
