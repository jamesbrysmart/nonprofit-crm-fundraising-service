import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('campaign')
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('date')
  startDate: Date;

  @Column('date')
  endDate: Date;
}
