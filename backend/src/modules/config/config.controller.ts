import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ConfigService } from './config.service';
import { ConfigDto } from './dto/config.dto';

@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  findAll() {
    return this.configService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.configService.findOne(+id);
  }

  @Post()
  create(@Body() configDto: ConfigDto) {
    return this.configService.create(configDto);
  }
}
