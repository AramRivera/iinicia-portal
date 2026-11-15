/** Centraliza el mensaje devuelto por el endpoint raíz. */
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
