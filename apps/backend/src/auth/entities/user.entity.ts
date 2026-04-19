import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserSessionEntity } from './user-session.entity';
import { GoogleGmailConnectionEntity } from './google-gmail-connection.entity';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  displayName!: string | null;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  avatarUrl!: string | null;

  @Column({ type: 'varchar', length: 32, default: 'google' })
  provider!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  providerSubject!: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  @OneToMany(() => UserSessionEntity, (session) => session.user)
  sessions!: UserSessionEntity[];

  @OneToOne(
    () => GoogleGmailConnectionEntity,
    (gmailConnection) => gmailConnection.user,
  )
  gmailConnection!: GoogleGmailConnectionEntity | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
