/**
 * MCP GENERATED SERVICE
 * Généré automatiquement par MCP Context-7
 * Source: welcome.php
 */

import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WelcomeService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService
  ) {}

  async validateSession(log: string, mykey: string) {
    // Validation de la clé de session
    if (!mykey || mykey === 'default' || mykey === 'NULL') {
      return {
        destinationLink: this.configService.get('ACCESS_EXPIRED_LINK'),
        ssid: 0,
        accessRequest: false,
        destinationLinkMsg: 'Expired',
        destinationLinkGranted: 0
      };
    }

    // Requête de validation en base
    const user = await this.databaseService.query(
      'SELECT * FROM ___CONFIG_ADMIN WHERE CNFA_LOGIN = ? AND CNFA_KEYLOG = ?',
      [log, mykey]
    );

    if (!user) {
      return {
        destinationLink: this.configService.get('ACCESS_REFUSED_LINK'),
        ssid: 0,
        accessRequest: false,
        destinationLinkMsg: 'Denied',
        destinationLinkGranted: 0
      };
    }

    if (user.CNFA_ACTIV === '1') {
      return {
        destinationLink: this.configService.get('ACCESS_PERMITTED_LINK'),
        ssid: user.CNFA_ID,
        accessRequest: true,
        destinationLinkMsg: 'Granted',
        destinationLinkGranted: 1
      };
    }

    return {
      destinationLink: this.configService.get('ACCESS_SUSPENDED_LINK'),
      ssid: 0,
      accessRequest: false,
      destinationLinkMsg: 'Suspended',
      destinationLinkGranted: 0
    };
  }
}
