import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('gift')
export class Gift {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'contact_id', type: 'varchar' })
  contactId: string;

  @Column({ name: 'campaign_id', type: 'varchar', nullable: true })
  campaignId: string | null;

  @Column({ name: 'amount_currency_code', type: 'varchar' })
  amountCurrencyCode: string;

  @Column({ name: 'amount_value', type: 'numeric', precision: 10, scale: 2 })
  amountValue: string;

  @Column({ name: 'gift_date', type: 'date' })
  date: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
