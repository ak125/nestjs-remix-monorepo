import { Injectable } from '@nestjs/common';
import { EcommerceDto } from './dto/ecommerce.dto';

@Injectable()
export class EcommerceService {
  findAll() {
    return `This action returns all ecommerce`;
  }

  findOne(id: number) {
    return `This action returns a #${id} ecommerce`;
  }

  create(ecommerceDto: EcommerceDto) {
    return `This action adds a new ecommerce`;
  }

  update(id: number, ecommerceDto: EcommerceDto) {
    return `This action updates a #${id} ecommerce`;
  }

  remove(id: number) {
    return `This action removes a #${id} ecommerce`;
  }
}
