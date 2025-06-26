import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ErrorsService } from './errors.service';
import { ErrorsDto } from './dto/errors.dto';

@Controller('errors')
export class ErrorsController {
  constructor(private readonly errorsService: ErrorsService) {}

  @Get()
  findAll() {
    return this.errorsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.errorsService.findOne(+id);
  }

  @Post()
  create(@Body() errorsDto: ErrorsDto) {
    return this.errorsService.create(errorsDto);
  }
}
