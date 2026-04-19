import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('google_gmail_connections')
export class GoogleGmailConnectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  userId!: string;

  @OneToOne(() => UserEntity, (user) => user.gmailConnection, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @Column({ type: 'varchar', length: 320, nullable: true })
  gmailEmail!: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  scopes!: string[];

  @Column({ type: 'text' })
  refreshTokenEncrypted!: string;

  @Column({ type: 'timestamptz', nullable: true })
  accessTokenExpiresAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  connectedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  disconnectedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastSyncAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  nextSyncAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
