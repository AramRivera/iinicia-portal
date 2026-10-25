import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  MoodleCourseResponse,
  MoodleErrorResponse,
  MoodleUserResponse,
} from './moodle.types.js';

@Injectable()
export class MoodleClient {
  private readonly logger = new Logger(MoodleClient.name);

  constructor(private readonly config: ConfigService) {}

  private getBaseUrl(): string {
    const url = this.config.get<string>('MOODLE_URL') || 'http://localhost/moodle';
    return url.replace(/\/+$/, '');
  }

  private getToken(): string {
    return this.config.get<string>('MOODLE_WS_TOKEN') || '';
  }

  async checkConnection(): Promise<{ ok: boolean; message?: string }> {
    const token = this.getToken();
    if (!token) {
      return {
        ok: false,
        message: 'MOODLE_WS_TOKEN no está configurado en las variables de entorno.',
      };
    }

    try {
      // Intentamos llamar a core_webservice_get_site_info
      const result = await this.callFunction<{ sitename?: string }>(
        'core_webservice_get_site_info',
      );
      return {
        ok: true,
        message: `Conectado a Moodle: ${result?.sitename ?? 'Sitio Moodle'}`,
      };
    } catch (error: any) {
      return {
        ok: false,
        message: error?.message || 'No fue posible conectar con Moodle Web Services.',
      };
    }
  }

  /**
   * Busca un usuario en Moodle por su correo electrónico.
   * Utiliza la función oficial `core_user_get_users_by_field`.
   */
  async getUserByEmail(email: string): Promise<MoodleUserResponse | null> {
    const users = await this.callFunction<MoodleUserResponse[]>(
      'core_user_get_users_by_field',
      {
        field: 'email',
        values: [email.toLowerCase().trim()],
      },
    );

    if (Array.isArray(users) && users.length > 0) {
      return users[0] ?? null;
    }
    return null;
  }

  /**
   * Busca un usuario en Moodle por su ID numérico.
   */
  async getUserById(id: number): Promise<MoodleUserResponse | null> {
    const users = await this.callFunction<MoodleUserResponse[]>(
      'core_user_get_users_by_field',
      {
        field: 'id',
        values: [id],
      },
    );

    if (Array.isArray(users) && users.length > 0) {
      return users[0] ?? null;
    }
    return null;
  }

  /**
   * Busca un usuario en Moodle por su nombre de usuario (username).
   */
  async getUserByUsername(username: string): Promise<MoodleUserResponse | null> {
    const users = await this.callFunction<MoodleUserResponse[]>(
      'core_user_get_users_by_field',
      {
        field: 'username',
        values: [username.toLowerCase().trim()],
      },
    );

    if (Array.isArray(users) && users.length > 0) {
      return users[0] ?? null;
    }
    return null;
  }

  /**
   * Crea un usuario en Moodle mediante `core_user_create_users`.
   */
  async createUser(params: {
    username: string;
    email: string;
    firstname: string;
    lastname: string;
    password?: string;
  }): Promise<MoodleUserResponse> {
    // Si no se especifica contraseña, se genera una segura conforme a las políticas de Moodle
    const password = params.password || generateTemporaryPassword();

    const response = await this.callFunction<Array<{ id: number; username: string }>>(
      'core_user_create_users',
      {
        users: [
          {
            username: params.username.toLowerCase().trim(),
            password,
            firstname: params.firstname || 'Usuario',
            lastname: params.lastname || 'IINICIA',
            email: params.email.toLowerCase().trim(),
            auth: 'manual',
          },
        ],
      },
    );

    if (!Array.isArray(response) || response.length === 0 || !response[0]?.id) {
      throw new InternalServerErrorException(
        'Moodle no devolvió el identificador del usuario creado.',
      );
    }

    return {
      id: response[0].id,
      username: response[0].username,
      firstname: params.firstname,
      lastname: params.lastname,
      email: params.email,
    };
  }

  /**
   * Actualiza el estado o datos del usuario en Moodle (`core_user_update_users`).
   */
  async updateUser(
    id: number,
    data: Partial<{ suspended: number }>,
  ): Promise<void> {
    await this.callFunction('core_user_update_users', {
      users: [
        {
          id,
          ...data,
        },
      ],
    });
  }

  /**
   * Inscribe a un usuario a un curso con un rol determinado (`enrol_manual_enrol_users`).
   */
  async enrolUser(params: {
    userId: number;
    courseId: number;
    roleId: number;
  }): Promise<void> {
    await this.callFunction('enrol_manual_enrol_users', {
      enrolments: [
        {
          roleid: params.roleId,
          userid: params.userId,
          courseid: params.courseId,
        },
      ],
    });
  }

  /**
   * Desmatricula a un usuario de un curso (`enrol_manual_unenrol_users`).
   */
  async unenrolUser(params: {
    userId: number;
    courseId: number;
    roleId?: number;
  }): Promise<void> {
    await this.callFunction('enrol_manual_unenrol_users', {
      enrolments: [
        {
          userid: params.userId,
          courseid: params.courseId,
          roleid: params.roleId,
        },
      ],
    });
  }

  /**
   * Obtiene los cursos matriculados de un usuario (`core_enrol_get_users_courses`).
   */
  async getUserCourses(moodleUserId: number): Promise<MoodleCourseResponse[]> {
    const courses = await this.callFunction<MoodleCourseResponse[]>(
      'core_enrol_get_users_courses',
      {
        userid: moodleUserId,
      },
    );
    return Array.isArray(courses) ? courses : [];
  }

  /**
   * Obtiene los detalles de un curso en Moodle por su ID (`core_course_get_courses_by_field`).
   */
  async getCourseById(courseId: number): Promise<MoodleCourseResponse | null> {
    const response = await this.callFunction<{ courses: MoodleCourseResponse[] }>(
      'core_course_get_courses_by_field',
      {
        field: 'id',
        value: courseId,
      },
    );

    if (response?.courses && Array.isArray(response.courses) && response.courses.length > 0) {
      return response.courses[0] ?? null;
    }
    return null;
  }

  /**
   * Ejecuta una petición HTTP a `server.php` de Moodle Web Services.
   */
  private async callFunction<T>(
    wsfunction: string,
    params: Record<string, any> = {},
  ): Promise<T> {
    const token = this.getToken();
    const baseUrl = this.getBaseUrl();

    if (!token) {
      throw new ServiceUnavailableException(
        'La integración con Moodle no cuenta con token configurado (MOODLE_WS_TOKEN).',
      );
    }

    const endpoint = `${baseUrl}/webservice/rest/server.php`;

    // Serializar parámetros anidados en formato form-urlencoded compatible con PHP/Moodle
    // ej: users[0][username]=xxx
    const body = new URLSearchParams();
    body.append('wstoken', token);
    body.append('wsfunction', wsfunction);
    body.append('moodlewsrestformat', 'json');

    serializeMoodleParams(body, '', params);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });
    } catch (err: any) {
      this.logger.error(
        `Fallo al comunicar con Moodle (${wsfunction}): ${err?.message || err}`,
      );
      throw new ServiceUnavailableException(
        'No fue posible comunicar con el servidor de Moodle LMS.',
      );
    }

    if (!response.ok) {
      this.logger.error(
        `Moodle respondió con estado HTTP ${response.status}: ${response.statusText}`,
      );
      throw new ServiceUnavailableException(
        `Moodle LMS respondió con código de error ${response.status}.`,
      );
    }

    const json = (await response.json()) as MoodleErrorResponse & T;

    // Moodle devuelve excepciones con `{ exception: "...", errorcode: "...", message: "..." }`
    if (json && typeof json === 'object' && ('exception' in json || 'errorcode' in json)) {
      this.logger.error(
        `Error de Moodle Web Service (${wsfunction}): [${json.errorcode}] ${json.message}`,
      );
      throw new InternalServerErrorException(
        `Error en Moodle LMS: ${json.message || json.errorcode || 'Error desconocido'}`,
      );
    }

    return json as T;
  }
}

/**
 * Convierte objetos y arreglos anidados a formato PHP x-www-form-urlencoded
 * ej: enrolments[0][roleid]=5&enrolments[0][userid]=12
 */
function serializeMoodleParams(
  target: URLSearchParams,
  prefix: string,
  data: any,
): void {
  if (data === null || data === undefined) return;

  if (typeof data === 'object') {
    for (const key of Object.keys(data)) {
      const val = data[key];
      const newKey = prefix ? `${prefix}[${key}]` : key;
      if (typeof val === 'object' && val !== null) {
        serializeMoodleParams(target, newKey, val);
      } else if (val !== undefined && val !== null) {
        target.append(newKey, String(val));
      }
    }
  } else {
    target.append(prefix, String(data));
  }
}

function generateTemporaryPassword(): string {
  // Cumple con la política habitual de Moodle: mayúscula, minúscula, número y símbolo
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const uppers = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%*_+';
  return (
    uppers[Math.floor(Math.random() * uppers.length)] +
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('') +
    symbols[Math.floor(Math.random() * symbols.length)] +
    Array.from({ length: 4 }, () => numbers[Math.floor(Math.random() * numbers.length)]).join('') +
    '!'
  );
}
