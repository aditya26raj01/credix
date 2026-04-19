import { IsOptional, IsString, MinLength } from 'class-validator';

export class GoogleGmailConnectDto {
  @IsString()
  @MinLength(10)
  code!: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  redirectUri?: string;

  @IsOptional()
  @IsString()
  @MinLength(32)
  codeVerifier?: string;
}
