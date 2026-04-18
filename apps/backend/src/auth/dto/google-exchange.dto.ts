import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class GoogleExchangeDto {
  @IsString()
  @MinLength(1)
  idToken!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceInfo?: string;
}
