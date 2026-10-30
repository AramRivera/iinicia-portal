import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { CreateContactMessageDto } from './dto/create-contact-message.dto.js';

@Injectable()
export class CmsService {
  private readonly logger = new Logger(CmsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Consulta contenidos institucionales publicados (páginas, noticias, avisos).
   */
  async findPublishedContents(type?: string) {
    const client = this.supabase.getClient('');
    let query = client
      .from('cms_contents')
      .select('id, slug, title, excerpt, content_type, featured_image_url, published_at')
      .eq('status', 'publicado')
      .order('published_at', { ascending: false });

    if (type) {
      query = query.eq('content_type', type as any);
    }

    const { data, error } = await query;
    if (error) {
      this.logger.error(`Error al consultar contenidos CMS: ${error.message}`);
      throw new InternalServerErrorException('No fue posible consultar los contenidos institucionales.');
    }

    return data || [];
  }

  /**
   * Consulta un contenido CMS por su slug (ej: /quienes-somos, /modelo-educativo).
   */
  async findContentBySlug(slug: string) {
    const client = this.supabase.getClient('');
    const { data, error } = await client
      .from('cms_contents')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'publicado')
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException('Contenido institucional no encontrado.');
    }

    return data;
  }

  /**
   * Directorio institucional público (autoridades y docentes).
   */
  async getDirectory() {
    const client = this.supabase.getClient('');
    const { data, error } = await client
      .from('institutional_directory')
      .select('*')
      .eq('is_visible', true)
      .order('display_order', { ascending: true });

    if (error) {
      this.logger.error(`Error al consultar directorio: ${error.message}`);
      throw new InternalServerErrorException('No fue posible consultar el directorio institucional.');
    }

    return data || [];
  }

  /**
   * Registra un mensaje del formulario público de contacto.
   */
  async submitContactMessage(dto: CreateContactMessageDto, ipAddress?: string) {
    const client = this.supabase.getClient('');
    const { data, error } = await client
      .from('contact_messages')
      .insert({
        full_name: dto.full_name,
        email: dto.email,
        phone: dto.phone ?? null,
        subject: dto.subject,
        program_of_interest: dto.program_of_interest ?? null,
        message: dto.message,
        status: 'nuevo',
        ip_address: ipAddress ?? null,
      })
      .select('id, created_at')
      .maybeSingle();

    if (error || !data) {
      this.logger.error(`Error al registrar mensaje de contacto: ${error?.message}`);
      throw new InternalServerErrorException('No fue posible enviar tu mensaje de contacto.');
    }

    return {
      success: true,
      message_id: data.id,
      submitted_at: data.created_at,
    };
  }

  /**
   * Mapa de redirecciones activas 301/302 de WordPress para el middleware de Next.js.
   */
  async getRedirectsMap() {
    const client = this.supabase.getClient('');
    const { data, error } = await client
      .from('wp_migration_inventory')
      .select('legacy_url, new_target_url, http_redirect_code')
      .eq('is_redirect_active', true)
      .not('new_target_url', 'is', null);

    if (error) {
      this.logger.error(`Error al consultar mapa de redirecciones: ${error.message}`);
      return [];
    }

    return data || [];
  }
}
