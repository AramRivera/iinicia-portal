// IINICIA Portal · API NestJS · app.service.ts
/** Centraliza el mensaje devuelto por el endpoint raíz. */
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  /** Expone un mensaje de bienvenida como respuesta de la raíz de la API. */
  getHello(): string {
    return 'Hello World!';
  }
}
