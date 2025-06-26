import { Injectable } from '@nestjs/common';
import { ErrorsDto } from './dto/errors.dto';

@Injectable()
export class ErrorsService {
  findAll() {
    return `This action returns all errors`;
  }

  findOne(id: number) {
    return `This action returns a #${id} errors`;
  }

  create(errorsDto: ErrorsDto) {
    return `This action adds a new errors`;
  }

  update(id: number, errorsDto: ErrorsDto) {
    return `This action updates a #${id} errors`;
  }

  remove(id: number) {
    return `This action removes a #${id} errors`;
  }
}
