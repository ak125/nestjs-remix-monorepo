/**
 * MCP GENERATED DTOs
 * Généré automatiquement par MCP Context-7
 * Source: welcome.php
 */

import { IsString, IsNumber, IsBoolean, IsOptional } from 'class-validator';

export class SessionValidationDto {
  @IsString()
  log: string;

  @IsString()
  mykey: string;
}

export class AuthResultDto {
  @IsString()
  destinationLink: string;

  @IsNumber()
  ssid: number;

  @IsBoolean()
  accessRequest: boolean;

  @IsString()
  destinationLinkMsg: string;

  @IsNumber()
  destinationLinkGranted: number;
}

export class WelcomeResponseDto {
  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsOptional()
  userInfo?: AuthResultDto;
}
