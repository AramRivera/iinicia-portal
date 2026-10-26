export type RoleSlug =
  | 'superadministrador'
  | 'administrador'
  | 'coordinador'
  | 'profesor'
  | 'estudiante'
  | 'aspirante'
  | 'soporte';

export type MoodleSyncStatus =
  | 'no_vinculado'
  | 'pendiente'
  | 'sincronizado'
  | 'error'
  | 'suspendido_en_moodle';

export type UserStatus = 'activo' | 'inactivo' | 'suspendido' | 'pendiente' | 'baja';

export interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  status: UserStatus;
  roles: RoleSlug[];
  active_roles?: RoleSlug[];
  permissions?: string[];
  moodle_user_id?: number | null;
  moodle_username?: string | null;
  moodle_sync_status?: MoodleSyncStatus;
  moodle_last_sync_at?: string | null;
  created_at?: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  expires_at?: number;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  expires_at?: number;
  user: {
    id: string;
    email: string;
  };
  session?: AuthSession;
}

export interface RegisterResponse {
  id: string;
  email: string;
  session: AuthSession | null;
  access_token?: string;
}

export interface CourseOffering {
  id: string;
  course_mapping_id: string;
  code: string;
  name: string;
  portal_course_code?: string;
  slug?: string;
  course_name?: string;
  course_description?: string;
  program_name: string;
  program_id?: string;
  moodle_course_id: number;
  moodle_shortname?: string;
  moodle_course_url?: string;
  is_active?: boolean;
  term_or_module?: number;
  is_mandatory?: boolean;
  credits: number;
  hours_theory: number;
  hours_practice: number;
  programs?: {
    code: string;
    name: string;
    slug: string;
  };
}

export interface RoleItem {
  id: number;
  slug: string;
  name: string;
  description: string;
  hierarchy_level: number;
  default_moodle_archetype: string | null;
  is_system: boolean;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  target_user_id?: string | null;
  action: string;
  entity_name: string;
  entity_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  details?: any;
  created_at: string;
}

export interface CreateCoursePayload {
  program_id?: string;
  portal_course_code: string;
  slug: string;
  course_name: string;
  course_description?: string;
  term_or_module?: number;
  is_mandatory?: boolean;
  moodle_course_id: number;
  moodle_shortname: string;
  is_active?: boolean;
}

export interface AuthorizedCourse {
  course_mapping_id: string;
  course_code: string;
  course_name: string;
  moodle_course_id: number;
  enrollment_status: 'autorizada' | 'sincronizada';
  role_in_course: 'student' | 'teacher';
}

export interface EnrollmentRequest {
  id: string;
  user_id: string;
  course_mapping_id: string;
  moodle_role?: string;
  status: 'pendiente' | 'autorizada' | 'rechazada' | 'sincronizada' | 'error_sincronizacion';
  moodle_sync_status: MoodleSyncStatus;
  moodle_enrolled_at?: string | null;
  created_at: string;
  course_mappings?: {
    code: string;
    moodle_course_id: number;
    moodle_shortname: string;
    courses?: {
      name: string;
      code: string;
    };
  };
  profiles?: {
    email: string;
    first_name: string;
    last_name: string;
  };
}

export interface MoodleLaunchResponse {
  course_mapping_id: string;
  course_name: string;
  moodle_course_id: number;
  access_url: string;
}

export interface MoodleStatusResponse {
  ok: boolean;
  message: string;
}

export interface Program {
  id: string;
  code: string;
  slug: string;
  name: string;
  short_description: string;
  description: string;
  type: 'licenciatura' | 'maestria' | 'diplomado' | 'curso';
  modality: 'en_linea' | 'presencial' | 'hibrido' | 'autogestivo';
  duration_text: string;
  duration_hours: number;
  is_featured: boolean;
  is_active: boolean;
}
