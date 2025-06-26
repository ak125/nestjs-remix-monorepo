import { Injectable } from '@nestjs/common';
import { CatalogDto } from './dto/catalog.dto';

@Injectable()
export class CatalogService {
  findAll() {
    return `This action returns all catalog`;
  }

  findOne(id: number) {
    return `This action returns a #${id} catalog`;
  }

  create(catalogDto: CatalogDto) {
    return `This action adds a new catalog`;
  }

  update(id: number, catalogDto: CatalogDto) {
    return `This action updates a #${id} catalog`;
  }

  remove(id: number) {
    return `This action removes a #${id} catalog`;
  }
}
