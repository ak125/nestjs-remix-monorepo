import { Injectable } from '@nestjs/common';
import { MarketingDataService } from './marketing-data.service';
import {
  BacklinkFilters,
  MarketingBacklink,
} from '../interfaces/marketing.interfaces';

@Injectable()
export class MarketingBacklinksService {
  constructor(private readonly dataService: MarketingDataService) {}

  async getBacklinks(filters: BacklinkFilters) {
    return this.dataService.getBacklinks(filters);
  }

  async getStats() {
    return this.dataService.getBacklinkStats();
  }

  async create(data: Partial<MarketingBacklink>) {
    return this.dataService.createBacklink(data);
  }

  async bulkImport(items: Partial<MarketingBacklink>[]) {
    return this.dataService.createBacklinks(items);
  }

  async update(id: number, data: Partial<MarketingBacklink>) {
    return this.dataService.updateBacklink(id, data);
  }

  async delete(id: number) {
    return this.dataService.deleteBacklink(id);
  }
}
