import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { EcommerceService } from './ecommerce.service';
import { EcommerceDto } from './dto/ecommerce.dto';

@Controller('ecommerce')
export class EcommerceController {
  constructor(private readonly ecommerceService: EcommerceService) {}

  @Get()
  findAll() {
    return this.ecommerceService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ecommerceService.findOne(+id);
  }

  @Post()
  create(@Body() ecommerceDto: EcommerceDto) {
    return this.ecommerceService.create(ecommerceDto);
  }
}
