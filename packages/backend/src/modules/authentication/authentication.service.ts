import { Injectable } from '@nestjs/common';
import { AuthenticationDto } from './dto/authentication.dto';

@Injectable()
export class AuthenticationService {
  findAll() {
    return `This action returns all authentication`;
  }

  findOne(id: number) {
    return `This action returns a #${id} authentication`;
  }

  create(authenticationDto: AuthenticationDto) {
    return `This action adds a new authentication`;
  }

  update(id: number, authenticationDto: AuthenticationDto) {
    return `This action updates a #${id} authentication`;
  }

  remove(id: number) {
    return `This action removes a #${id} authentication`;
  }
}
