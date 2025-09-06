import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('gift')
export class Gift {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  contactId: string;

  @Column()
  campaignId: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column('date')
  date: Date;
}
