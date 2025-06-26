import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogDto } from './dto/catalog.dto';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  findAll() {
    return this.catalogService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.catalogService.findOne(+id);
  }

  @Post()
  create(@Body() catalogDto: CatalogDto) {
    return this.catalogService.create(catalogDto);
  }
}
