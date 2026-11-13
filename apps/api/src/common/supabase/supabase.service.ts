import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { Database } from './database.types.js';
import { readSupabaseTokenClaims } from '../auth/supabase-token-claims.js';

/** Primer segmento de la URL a la que PostgREST sirve `/rest/v1/<tabla>`. */
const CAPTCHA_MESSAGE = 'No se pudo verificar el CAPTCHA. Completa un nuevo desafío.';

const RECOVERY_MESSAGE =
  'Solicitud recibida. Si podemos enviar un enlace para esa dirección, lo recibirás por correo.';

const REST_PATH = '/rest/v1/';
const PORTAL_TOTP_FACTOR = 'IINICIA';

function preservePostgrestError(
  fetchImpl: typeof globalThis.fetch,
): typeof globalThis.fetch {
  return async (input, init) => {
    const response = await fetchImpl(input, init);
    if (response.ok) return response;

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) return response;

    let body: unknown;
    try {
      body = await response.clone().json();
    } catch {
      return response;
    }
    if (typeof body !== 'object' || body === null) return response;
    const { code, message, details, hint, error } = body as Record<
      string,
      unknown
    >;
    if (typeof message !== 'string' && typeof error !== 'string') {
      return response;
    }

    const headers = new Headers(response.headers);
    headers.set('content-type', 'application/json');
    return new Response(
      JSON.stringify({
        code: code ?? null,
        message: typeof error === 'string' ? error : message,
        details: details ?? null,
        hint: hint ?? null,
      }),
      { status: response.status, statusText: response.statusText, headers },
    );
  };
}

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);

  constructor(private readonly config: ConfigService) {}

  assertConfiguration(): void {
    this.getConfiguration();
  }

  /**
   * Registro de un nuevo usuario en Supabase Auth.
   * El trigger PostgreSQL `handle_new_auth_user` crea automáticamente el perfil
   * en `public.profiles` con estado 'pendiente' y rol inicial 'aspirante'.
   */
  async signUp(params: {
    email: string;
    password: string;
    captchaToken?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }): Promise<{ message: string }> {
    const message =
      'Si puedes registrar esta dirección, recibirás un enlace para confirmar tu correo.';
    try {
      const emailRedirectTo = this.getAuthRedirect('/confirmar-correo');
      await this.requireEmailConfirmation();

      const { data, error } = await this.createClient().auth.signUp({
        email: params.email,
        password: params.password,
        options: {
          emailRedirectTo,
          ...(params.captchaToken && { captchaToken: params.captchaToken }),
          data: {
            first_name: params.firstName ?? '',
            last_name: params.lastName ?? '',
            phone: params.phone ?? null,
          },
        },
      });

      if (error?.code === 'captcha_failed') throw new BadRequestException(CAPTCHA_MESSAGE);
      if (error?.code === 'user_already_exists') return { message };
      if (error?.status === 429) {
        throw new HttpException(
          'Demasiados intentos. Intenta más tarde.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      if (error?.code === 'weak_password') {
        throw new BadRequestException('Elige una contraseña más segura.');
      }
      if (error || !data.user || data.session) {
        throw new ServiceUnavailableException(
          'No fue posible iniciar la confirmación del correo.',
        );
      }
      return { message };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Falló la comunicación con Supabase durante el registro.');
      throw new ServiceUnavailableException(
        'No fue posible completar el registro en el servicio de identidad.',
      );
    }
  }

  private async requireEmailConfirmation(): Promise<void> {
    const { url, publishableKey } = this.getConfiguration();
    const response = await fetch(new URL('/auth/v1/settings', url), {
      headers: { apikey: publishableKey },
      signal: AbortSignal.timeout(5000),
    });
    const settings = response.ok
      ? await response.json() as {
          mailer_autoconfirm?: boolean;
          disable_signup?: boolean;
          external?: { email?: boolean };
        }
      : null;
    if (
      settings?.mailer_autoconfirm !== false ||
      settings.disable_signup !== false ||
      settings.external?.email !== true
    ) {
      throw new ServiceUnavailableException(
        'El registro con confirmación de correo no está disponible.',
      );
    }
  }

  private getAuthRedirect(path: '/confirmar-correo' | '/restablecer-password'): string {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:4000';
    try {
      const redirectTo = new URL(path, frontendUrl);
      if (!['http:', 'https:'].includes(redirectTo.protocol)) {
        throw new Error('Protocolo no válido.');
      }
      return redirectTo.href;
    } catch {
      throw new ServiceUnavailableException('El enlace del portal no está configurado.');
    }
  }

  async signInWithPassword(email: string, password: string, captchaToken?: string) {
    try {
      const { auth } = this.createClient();
      const { data, error } = await auth.signInWithPassword(
        {
          email,
          password,
          ...(captchaToken && { options: { captchaToken } }),
        },
      );

      if (error?.status === 429) {
        throw new HttpException(
          'Demasiados intentos. Intenta más tarde.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      if (error?.code === 'captcha_failed') throw new BadRequestException(CAPTCHA_MESSAGE);
      if (error?.code === 'email_not_confirmed') {
        throw new UnauthorizedException('Confirma tu correo antes de iniciar sesión.');
      }
      if (error) {
        if (
          error.status === 400 ||
          error.status === 401 ||
          error.status === 403 ||
          error.status === 422
        ) {
          throw new UnauthorizedException(
            'No fue posible iniciar sesión con esas credenciales.',
          );
        }
        throw new ServiceUnavailableException(
          'No fue posible contactar al servicio de autenticación.',
        );
      }
      if (!data.session || !data.user) {
        throw new ServiceUnavailableException(
          'El servicio de autenticación devolvió una sesión incompleta.',
        );
      }

      const mfaToken = data.session.access_token;
      if (readSupabaseTokenClaims(mfaToken).aal !== 'aal1') {
        throw new ServiceUnavailableException('No se pudo iniciar la verificación en dos pasos.');
      }

      const { data: factors, error: factorsError } = await auth.mfa.listFactors();
      if (factorsError) this.throwMfaError(factorsError.status);
      const verifiedTotp = factors.totp;
      if (verifiedTotp.length > 0) {
        return {
          step: 'verify' as const,
          mfa_token: mfaToken,
          factors: totpOptions(verifiedTotp),
        };
      }

      if (factors.all.some((factor) => factor.status === 'verified')) {
        throw new ForbiddenException('Tu cuenta requiere un factor compatible con el portal. Contacta a soporte.');
      }

      // Un alta abandonada no debe impedir volver a configurar el autenticador.
      for (const factor of factors.all) {
        if (factor.factor_type !== 'totp' || factor.status !== 'unverified' || factor.friendly_name !== PORTAL_TOTP_FACTOR) continue;
        const { error: unenrollError } = await auth.mfa.unenroll({ factorId: factor.id });
        if (unenrollError && unenrollError.status !== 404) this.throwMfaError(unenrollError.status);
      }

      const { data: factor, error: enrollmentError } = await auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: PORTAL_TOTP_FACTOR,
        issuer: 'IINICIA',
      });
      if (enrollmentError) this.throwMfaError(enrollmentError.status);
      const qrPrefix = 'data:image/svg+xml;utf-8,';
      const qrCode = factor.totp.qr_code?.startsWith(qrPrefix)
        ? `data:image/svg+xml;base64,${Buffer.from(factor.totp.qr_code.slice(qrPrefix.length)).toString('base64')}`
        : undefined;
      return {
        step: 'setup' as const,
        mfa_token: mfaToken,
        factor_id: factor.id,
        secret: factor.totp.secret,
        qr_code: qrCode,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        'Falló la comunicación con Supabase Auth durante el inicio de sesión.',
      );
      throw new ServiceUnavailableException(
        'No fue posible contactar al servicio de autenticación.',
      );
    }
  }

  verifyLoginMfa(accessToken: string, factorId: string, code: string) {
    return this.verifyMfa(accessToken, factorId, code, 'password');
  }

  async resetPasswordWithMfa(accessToken: string, factorId: string, code: string, password: string) {
    this.validatePasswordSize(password);
    const session = await this.verifyMfa(accessToken, factorId, code, 'recovery');
    const { auth } = this.createClient();
    const { error } = await auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (error) throw new ServiceUnavailableException('No fue posible iniciar la sesión de recuperación.');
    return this.updateRecoveredPassword(auth, password);
  }

  private async verifyMfa(accessToken: string, factorId: string, code: string, method: 'password' | 'recovery') {
    const user = await this.getAuthenticatedUser(accessToken);
    // Supabase etiqueta el enlace PKCE como recovery y el intercambio verifyOtp como otp.
    const matchesMethod = hasAuthMethod(accessToken, method) ||
      (method === 'recovery' && hasAuthMethod(accessToken, 'otp'));
    if (readSupabaseTokenClaims(accessToken).aal !== 'aal1' || !matchesMethod) {
      throw new UnauthorizedException('La sesión no corresponde a esta verificación.');
    }

    const factors = user.factors ?? [];
    const factor = factors.find((item) => item.id === factorId && item.factor_type === 'totp');
    const firstEnrollment = method === 'password' && factor?.status === 'unverified' &&
      factor.friendly_name === PORTAL_TOTP_FACTOR &&
      !factors.some((item) => item.status === 'verified');
    if (factor?.status !== 'verified' && !firstEnrollment) {
      throw new ForbiddenException('Este autenticador no está disponible. Vuelve a iniciar sesión.');
    }

    // La continuación usa solo el JWT AAL1. El navegador nunca recibe su refresh token.
    const path = `/factors/${factorId}`;
    const challenge = await this.postAuth(`${path}/challenge`, {}, accessToken);
    if (!challenge.ok) this.throwMfaError(challenge.status, true);
    const challengeData: unknown = await challenge.json().catch(() => null);
    if (!challengeData || typeof challengeData !== 'object' || !('id' in challengeData) ||
        typeof challengeData.id !== 'string' || !challengeData.id) {
      throw new ServiceUnavailableException('Supabase no devolvió un desafío de verificación.');
    }

    const response = await this.postAuth(`${path}/verify`, {
      challenge_id: challengeData.id,
      code,
    }, accessToken);
    if (!response.ok) this.throwMfaError(response.status, true);
    const session = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!session || typeof session.access_token !== 'string' ||
        typeof session.refresh_token !== 'string' || !session.refresh_token ||
        typeof session.expires_in !== 'number' || session.expires_in <= 0 ||
        typeof session.token_type !== 'string') {
      throw new ServiceUnavailableException('Supabase devolvió una sesión incompleta.');
    }
    const claims = readSupabaseTokenClaims(session.access_token);
    if (claims.aal !== 'aal2' || claims.sub !== user.id) {
      throw new ServiceUnavailableException('Supabase no confirmó la sesión con dos factores.');
    }

    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      token_type: session.token_type,
      expires_in: session.expires_in,
      expires_at: typeof claims.exp === 'number' ? claims.exp : undefined,
      user: { id: user.id, email: user.email },
    };
  }

  private throwMfaError(status?: number, verifying = false): never {
    if (status === 429) {
      throw new HttpException('Demasiados intentos. Intenta más tarde.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (verifying && status === 401) {
      throw new UnauthorizedException('La sesión de verificación caducó. Vuelve a iniciar sesión.');
    }
    if (verifying && (status === 400 || status === 422)) {
      throw new BadRequestException('No se pudo verificar el código. Usa el código actual de tu app.');
    }
    if (verifying && (status === 403 || status === 404)) {
      throw new ForbiddenException('Este autenticador no está disponible. Vuelve a iniciar sesión.');
    }
    throw new ServiceUnavailableException('La verificación en dos pasos no está disponible.');
  }

  async getAuthenticatedUser(accessToken: string): Promise<User> {
    try {
      const { data, error } =
        await this.createClient(accessToken).auth.getUser(accessToken);

      if (error) {
        if (error.status === 401 || error.status === 403) {
          throw new UnauthorizedException('El token de acceso no es válido.');
        }

        this.logger.error('Supabase no pudo validar el token de acceso.');
        throw new ServiceUnavailableException(
          'No fue posible validar la sesión.',
        );
      }

      if (!data.user) {
        throw new UnauthorizedException('El token de acceso no es válido.');
      }

      return data.user;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }

      this.logger.error('Falló la comunicación con Supabase Auth.');
      throw new ServiceUnavailableException(
        'No fue posible validar la sesión.',
      );
    }
  }

  getClient(accessToken: string): SupabaseClient<Database> {
    return this.createClient(accessToken);
  }

  async requestPasswordRecovery(email: string, captchaToken?: string): Promise<{ message: string }> {
    const { error } = await this.createClient().auth.resetPasswordForEmail(email, {
      redirectTo: this.getAuthRedirect('/restablecer-password'),
      ...(captchaToken && { captchaToken }),
    });
    if (error?.code === 'captcha_failed') throw new BadRequestException(CAPTCHA_MESSAGE);
    if (error) this.logRecoveryFailure(error.status);
    // Una respuesta uniforme evita revelar si el correo existe o si alcanzó su cuota.
    return { message: RECOVERY_MESSAGE };
  }

  async requestPkcePasswordRecovery(email: string, challenge: string, captchaToken?: string): Promise<{ message: string }> {
    const query = new URLSearchParams({ redirect_to: this.getAuthRedirect('/restablecer-password') });
    const response = await this.postAuth(`/recover?${query}`, {
      email,
      code_challenge: challenge,
      code_challenge_method: 's256',
      ...(captchaToken && { gotrue_meta_security: { captcha_token: captchaToken } }),
    });
    if (!response.ok) {
      const failure: { code?: string; error_code?: string } | null =
        await response.json().catch(() => null);
      if (failure?.code === 'captcha_failed' || failure?.error_code === 'captcha_failed') {
        throw new BadRequestException(CAPTCHA_MESSAGE);
      }
      this.logRecoveryFailure(response.status);
    }
    return { message: RECOVERY_MESSAGE };
  }

  private logRecoveryFailure(status?: number): void {
    if (status === 429) {
      this.logger.warn('Supabase Auth limitó una solicitud de recuperación (HTTP 429).');
    } else if (status === undefined || status >= 500) {
      this.logger.warn('Supabase Auth no pudo procesar una solicitud de recuperación.');
    }
  }

  async resetPasswordWithCode(
    code: string,
    verifier: string,
    password: string,
  ) {
    this.validatePasswordSize(password);
    const response = await this.postAuth('/token?grant_type=pkce', {
      auth_code: code,
      code_verifier: verifier,
    });
    if (response.status >= 500 || response.status === 429) {
      throw new ServiceUnavailableException('No fue posible verificar el enlace de recuperación.');
    }
    if (!response.ok) {
      throw new BadRequestException('El enlace de recuperación es inválido o ya caducó.');
    }
    const session: unknown = await response.json().catch(() => null);
    if (!isPasswordRecoverySession(session)) {
      throw new BadRequestException('El enlace no corresponde a una recuperación de contraseña.');
    }

    const { auth } = this.createClient();
    const { error } = await auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (error) {
      throw new ServiceUnavailableException('No fue posible iniciar la sesión de recuperación.');
    }
    return this.preparePasswordReset(auth, session.access_token, password);
  }

  private async postAuth(path: string, body: Record<string, unknown>, accessToken?: string): Promise<Response> {
    const { url, publishableKey } = this.getConfiguration();
    try {
      return await fetch(new URL(`/auth/v1${path}`, url), {
        method: 'POST',
        headers: {
          apikey: publishableKey,
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(body),
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new ServiceUnavailableException('No fue posible contactar a Supabase Auth.');
    }
  }

  private validatePasswordSize(password: string): void {
    if (Buffer.byteLength(password, 'utf8') > 72) {
      throw new BadRequestException('La contraseña no debe superar 72 bytes.');
    }
  }

  async resetPassword(tokenHash: string, password: string) {
    this.validatePasswordSize(password);

    const { auth } = this.createClient();
    const { data, error } = await auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
    if (error && (error.status === undefined || error.status >= 500)) {
      throw new ServiceUnavailableException('No fue posible verificar el enlace de recuperación.');
    }
    if (error || !data.session) {
      throw new BadRequestException('El enlace de recuperación es inválido o ya caducó.');
    }

    return this.preparePasswordReset(auth, data.session.access_token, password);
  }

  private async preparePasswordReset(auth: SupabaseClient<Database>['auth'], accessToken: string, password: string) {
    const { data, error } = await auth.mfa.listFactors();
    if (error) this.throwMfaError(error.status);
    if (data.totp.length > 0) {
      return { step: 'verify' as const, mfa_token: accessToken, factors: totpOptions(data.totp) };
    }
    if (data.all.some((factor) => factor.status === 'verified')) {
      throw new ForbiddenException('Tu cuenta requiere un factor compatible con el portal. Contacta a soporte.');
    }
    return this.updateRecoveredPassword(auth, password);
  }

  private async updateRecoveredPassword(auth: SupabaseClient<Database>['auth'], password: string) {
    const { error: updateError } = await auth.updateUser({ password });
    if (updateError) {
      if (updateError.code === 'weak_password' || updateError.code === 'same_password') {
        throw new BadRequestException(
          'Elige una contraseña segura y distinta de la anterior. Solicita un nuevo enlace para continuar.',
        );
      }
      throw new ServiceUnavailableException(
        'No fue posible cambiar la contraseña. Solicita un nuevo enlace para reintentar.',
      );
    }
    return { message: 'Tu contraseña se actualizó.' };
  }

  /**
   * Obtiene el cliente privilegiado (Service Role) aislado en el servidor.
   * Utilizar ÚNICAMENTE tras validación explícita de guards/permisos en NestJS
   * para operaciones administrativas, auditoría y sincronizaciones Moodle.
   */
  getAdminClient(): SupabaseClient<Database> {
    const { url, secretKey } = this.getAdminConfiguration();
    return createClient<Database>(url, secretKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }

  getResilientClient(accessToken: string): SupabaseClient<Database> {
    const client = this.getClient(accessToken);

    type FromRelation = (relation: string) => {
      url: URL;
      fetch: typeof globalThis.fetch;
    };
    const from = client.from.bind(client) as unknown as FromRelation;

    client.from = ((relation: string) => {
      const builder = from(relation);
      if (!builder.url.toString().includes(REST_PATH)) return builder;

      const fetchImpl = builder.fetch;
      builder.fetch = preservePostgrestError((input, init) =>
        fetchImpl(input, init),
      );
      return builder;
    }) as unknown as typeof client.from;

    return client;
  }

  private createClient(accessToken?: string): SupabaseClient<Database> {
    const { url, publishableKey } = this.getConfiguration();

    return createClient<Database>(url, publishableKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: accessToken
        ? {
            fetch: (input, init) => {
              const headers = new Headers(init?.headers);
              headers.set('Authorization', `Bearer ${accessToken}`);
              return fetch(input, { ...init, headers });
            },
          }
        : {},
    });
  }

  private getConfiguration(): { url: string; publishableKey: string } {
    const url = this.config.get<string>('SUPABASE_URL');
    const publishableKey = this.config.get<string>('SUPABASE_PUBLISHABLE_KEY');

    if (!url || !publishableKey) {
      throw new Error(
        'SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY son obligatorias.',
      );
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error('SUPABASE_URL debe ser una URL válida.');
    }

    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      throw new Error('SUPABASE_URL debe usar HTTP o HTTPS.');
    }

    return { url, publishableKey };
  }

  private getAdminConfiguration(): { url: string; secretKey: string } {
    const { url } = this.getConfiguration();
    const secretKey = this.config.get<string>('SUPABASE_SECRET_KEY');

    if (!secretKey) {
      throw new Error(
        'SUPABASE_SECRET_KEY es obligatoria para operaciones administrativas del servidor.',
      );
    }

    return { url, secretKey };
  }
}


// This token comes directly from Supabase Auth over the PKCE exchange, never from the client.
function isPasswordRecoverySession(value: unknown): value is {
  access_token: string;
  refresh_token: string;
} {
  if (!value || typeof value !== 'object') return false;
  const { access_token, refresh_token } = value as Record<string, unknown>;
  if (typeof access_token !== 'string' || typeof refresh_token !== 'string' || !refresh_token) return false;

  return hasAuthMethod(access_token, 'recovery');
}

function hasAuthMethod(token: string, method: 'password' | 'recovery' | 'otp'): boolean {
  const { amr } = readSupabaseTokenClaims(token);
  return Array.isArray(amr) && amr.some((claim: unknown) =>
    typeof claim === 'object' && claim !== null && 'method' in claim && claim.method === method,
  );
}

function totpOptions(factors: { id: string; friendly_name?: string }[]) {
  return factors.map((factor) => ({ id: factor.id, name: factor.friendly_name }));
}
