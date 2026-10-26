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
  permissions: string[];
  moodle_user_id?: number | null;
  moodle_username?: string | null;
  moodle_sync_status?: MoodleSyncStatus;
  moodle_last_sync_at?: string | null;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  expires_at?: number;
}

export interface LoginResponse {
  user: {
    id: string;
    email: string;
  };
  session: AuthSession;
}

export interface RegisterResponse {
  id: string;
  email: string;
  session: AuthSession | null;
}

export interface CourseOffering {
  id: string;
  course_mapping_id: string;
  code: string;
  name: string;
  program_name: string;
  moodle_course_id: number;
  credits: number;
  hours_theory: number;
  hours_practice: number;
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
