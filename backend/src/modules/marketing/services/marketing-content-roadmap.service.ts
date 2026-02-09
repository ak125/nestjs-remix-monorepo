import { Injectable } from '@nestjs/common';
import { MarketingDataService } from './marketing-data.service';
import {
  RoadmapFilters,
  MarketingContentRoadmap,
} from '../interfaces/marketing.interfaces';

@Injectable()
export class MarketingContentRoadmapService {
  constructor(private readonly dataService: MarketingDataService) {}

  async getRoadmap(filters: RoadmapFilters) {
    return this.dataService.getContentRoadmap(filters);
  }

  async getCoverage() {
    return this.dataService.getContentCoverage();
  }

  async create(data: Partial<MarketingContentRoadmap>) {
    return this.dataService.createRoadmapItem(data);
  }

  async update(id: number, data: Partial<MarketingContentRoadmap>) {
    return this.dataService.updateRoadmapItem(id, data);
  }

  async delete(id: number) {
    return this.dataService.deleteRoadmapItem(id);
  }
}
