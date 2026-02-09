import { Injectable } from '@nestjs/common';
import { MarketingDataService } from './marketing-data.service';

@Injectable()
export class MarketingDashboardService {
  constructor(private readonly dataService: MarketingDataService) {}

  async getDashboard() {
    return this.dataService.getDashboardStats();
  }

  async getKpiTimeline(days: number) {
    return this.dataService.getKpiTimeline(days);
  }

  async saveSnapshot(data: any) {
    return this.dataService.saveKpiSnapshot(data);
  }
}
