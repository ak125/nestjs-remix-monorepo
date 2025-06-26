import { Injectable } from '@nestjs/common';
import { ConfigDto } from './dto/config.dto';

@Injectable()
export class ConfigService {
  findAll() {
    return `This action returns all config`;
  }

  findOne(id: number) {
    return `This action returns a #${id} config`;
  }

  create(configDto: ConfigDto) {
    return `This action adds a new config`;
  }

  update(id: number, configDto: ConfigDto) {
    return `This action updates a #${id} config`;
  }

  remove(id: number) {
    return `This action removes a #${id} config`;
  }
}
