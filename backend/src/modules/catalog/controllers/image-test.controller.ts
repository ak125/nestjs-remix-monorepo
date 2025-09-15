import { Controller, Get } from '@nestjs/common';

@Controller('catalog/images')
export class ImageProcessingController {
  @Get('test')
  test() {
    return { message: 'Images controller works!' };
  }
}