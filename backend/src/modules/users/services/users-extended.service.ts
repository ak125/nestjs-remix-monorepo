import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class UsersExtendedService {
  private readonly logger = new Logger(UsersExtendedService.name);

  constructor() {}

  async getExtendedData(userId: string): Promise<any> {
    this.logger.log(`Getting extended data for user ${userId}`);
    return { userId, message: 'Extended service placeholder' };
  }
}
