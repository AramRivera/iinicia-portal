export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserStatus =
  | 'pendiente'
  | 'activo'
  | 'suspendido'
  | 'inactivo'
  | 'baja';

export type ProgramType =
  | 'licenciatura'
  | 'maestria'
  | 'diplomado'
  | 'certificacion'
  | 'curso'
  | 'taller'
  | 'otro';

export type ProgramModality =
  | 'en_linea'
  | 'presencial'
  | 'hibrido'
  | 'autogestivo';

export type AcademicStatus =
  | 'postulado'
  | 'en_revision'
  | 'admitido'
  | 'rechazado'
  | 'inscrito'
  | 'cursando'
  | 'egresado'
  | 'baja'
  | 'suspendido';

export type EnrollmentStatus =
  | 'pendiente'
  | 'autorizada'
  | 'rechazada'
  | 'sincronizada'
  | 'error_sincronizacion'
  | 'desmatriculada';

export type MoodleRoleType =
  | 'student'
  | 'editingteacher'
  | 'teacher'
  | 'manager'
  | 'coursecreator';

export type SyncStatusType =
  | 'no_vinculado'
  | 'pendiente'
  | 'sincronizado'
  | 'error'
  | 'suspendido_en_moodle';

export type CmsContentType =
  | 'pagina'
  | 'noticia'
  | 'aviso'
  | 'evento'
  | 'faq'
  | 'documento';

export type CmsContentStatus = 'borrador' | 'publicado' | 'archivado';

export type WpMigrationAction =
  | 'MIGRAR'
  | 'ACTUALIZAR'
  | 'REESCRIBIR'
  | 'ELIMINAR';

export type ContactMessageStatus = 'nuevo' | 'en_atencion' | 'resuelto' | 'spam';

export type ProfileRecord = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  curp_or_id: string | null;
  matricula: string | null;
  avatar_url: string | null;
  bio: string | null;
  status: UserStatus;
  moodle_user_id: number | null;
  moodle_username: string | null;
  moodle_sync_status: SyncStatusType;
  moodle_last_sync_at: string | null;
  moodle_sync_error: string | null;
  last_login_at: string | null;
  terms_accepted_at: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type RoleRecord = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  hierarchy_level: number;
  default_moodle_archetype: MoodleRoleType | null;
  is_system: boolean;
  created_at: string;
};

export type PermissionRecord = {
  id: number;
  code: string;
  module: string;
  description: string;
  created_at: string;
};

export type RolePermissionRecord = {
  role_id: number;
  permission_id: number;
  created_at: string;
};

export type UserRoleRecord = {
  id: string;
  user_id: string;
  role_id: number;
  assigned_by: string | null;
  is_active: boolean;
  expires_at: string | null;
  assigned_at: string;
  updated_at: string;
};

export type ProgramRecord = {
  id: string;
  code: string;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  type: ProgramType;
  modality: ProgramModality;
  duration_text: string | null;
  duration_hours: number | null;
  credits: number | null;
  banner_url: string | null;
  thumbnail_url: string | null;
  syllabus_pdf_url: string | null;
  admission_requirements: Json;
  graduate_profile: string | null;
  moodle_category_id: number | null;
  coordinator_id: string | null;
  is_featured: boolean;
  is_active: boolean;
  display_order: number;
  seo_title: string | null;
  seo_description: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type UserProgramRecord = {
  id: string;
  user_id: string;
  program_id: string;
  status: AcademicStatus;
  cohort: string | null;
  progress_percentage: number;
  authorized_by: string | null;
  enrolled_at: string;
  completed_at: string | null;
  notes: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type CourseMappingRecord = {
  id: string;
  program_id: string | null;
  portal_course_code: string;
  slug: string;
  course_name: string;
  course_description: string | null;
  thumbnail_url: string | null;
  term_or_module: number | null;
  is_mandatory: boolean;
  moodle_course_id: number;
  moodle_shortname: string;
  moodle_category_id: number | null;
  moodle_course_url: string | null;
  is_active: boolean;
  last_synced_at: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type EnrollmentRequestRecord = {
  id: string;
  user_id: string;
  course_mapping_id: string;
  program_id: string | null;
  moodle_role: MoodleRoleType;
  status: EnrollmentStatus;
  requested_by: string | null;
  authorized_by: string | null;
  authorized_at: string | null;
  moodle_enrol_id: number | null;
  synced_to_moodle_at: string | null;
  sync_attempts: number;
  sync_error_message: string | null;
  cached_progress: number | null;
  cached_final_grade: number | null;
  cached_completed: boolean | null;
  last_moodle_access_at: string | null;
  access_start_at: string | null;
  access_end_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CampusAccessLogRecord = {
  id: string;
  user_id: string;
  course_mapping_id: string | null;
  moodle_course_id: number | null;
  access_method: string;
  ip_address: string | null;
  user_agent: string | null;
  succeeded: boolean;
  error_detail: string | null;
  created_at: string;
};

export type AdmissionApplicationRecord = {
  id: string;
  applicant_id: string;
  program_id: string;
  status: AcademicStatus;
  previous_education_level: string | null;
  previous_institution: string | null;
  average_grade: number | null;
  motivation_letter: string | null;
  documents_json: Json;
  reviewer_id: string | null;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  submitted_at: string;
  updated_at: string;
};

export type InstitutionalDirectoryRecord = {
  id: string;
  profile_id: string | null;
  full_name: string;
  title_or_position: string;
  department: string | null;
  category: string;
  bio: string | null;
  photo_url: string | null;
  email_contact: string | null;
  linkedin_url: string | null;
  display_order: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
};

export type CmsContentRecord = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body_content: string;
  content_type: CmsContentType;
  status: CmsContentStatus;
  featured_image_url: string | null;
  author_id: string | null;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  legacy_wp_id: number | null;
  legacy_wp_url: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type ContactMessageRecord = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  subject: string;
  program_of_interest: string | null;
  message: string;
  status: ContactMessageStatus;
  attended_by: string | null;
  internal_notes: string | null;
  ip_address: string | null;
  attended_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WpMigrationInventoryRecord = {
  id: string;
  legacy_url: string;
  legacy_title: string | null;
  asset_type: string;
  action: WpMigrationAction;
  new_target_url: string | null;
  http_redirect_code: number | null;
  is_redirect_active: boolean;
  migration_completed: boolean;
  seo_notes: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditLogRecord = {
  id: string;
  actor_id: string | null;
  target_user_id: string | null;
  action: string;
  entity_name: string;
  entity_id: string | null;
  old_values: Json | null;
  new_values: Json | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type SystemSettingRecord = {
  key: string;
  value: Json;
  description: string | null;
  is_public: boolean;
  updated_by: string | null;
  updated_at: string;
};

export type VUserCompleteProfileRecord = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string | null;
  matricula: string | null;
  avatar_url: string | null;
  status: UserStatus;
  moodle_user_id: number | null;
  moodle_username: string | null;
  moodle_sync_status: SyncStatusType;
  moodle_last_sync_at: string | null;
  created_at: string;
  active_roles: string[];
  programs: Json;
};

export type VUserAuthorizedCourseRecord = {
  enrollment_id: string;
  user_id: string;
  moodle_role: MoodleRoleType;
  enrollment_status: EnrollmentStatus;
  synced_to_moodle_at: string | null;
  cached_progress: number | null;
  cached_final_grade: number | null;
  cached_completed: boolean | null;
  course_mapping_id: string;
  portal_course_code: string;
  course_slug: string;
  course_name: string;
  course_description: string | null;
  thumbnail_url: string | null;
  moodle_course_id: number;
  moodle_shortname: string;
  moodle_course_url: string | null;
  program_id: string | null;
  program_name: string | null;
  program_slug: string | null;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRecord;
        Insert: {
          id: string;
          email: string;
          first_name?: string;
          last_name?: string;
          phone?: string | null;
          curp_or_id?: string | null;
          matricula?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          status?: UserStatus;
          moodle_user_id?: number | null;
          moodle_username?: string | null;
          moodle_sync_status?: SyncStatusType;
          moodle_last_sync_at?: string | null;
          moodle_sync_error?: string | null;
          last_login_at?: string | null;
          terms_accepted_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          first_name?: string;
          last_name?: string;
          phone?: string | null;
          curp_or_id?: string | null;
          matricula?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          status?: UserStatus;
          moodle_user_id?: number | null;
          moodle_username?: string | null;
          moodle_sync_status?: SyncStatusType;
          moodle_last_sync_at?: string | null;
          moodle_sync_error?: string | null;
          last_login_at?: string | null;
          terms_accepted_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      roles: {
        Row: RoleRecord;
        Insert: {
          id?: number;
          slug: string;
          name: string;
          description?: string | null;
          hierarchy_level?: number;
          default_moodle_archetype?: MoodleRoleType | null;
          is_system?: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          slug?: string;
          name?: string;
          description?: string | null;
          hierarchy_level?: number;
          default_moodle_archetype?: MoodleRoleType | null;
          is_system?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      permissions: {
        Row: PermissionRecord;
        Insert: {
          id?: number;
          code: string;
          module: string;
          description: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          code?: string;
          module?: string;
          description?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      role_permissions: {
        Row: RolePermissionRecord;
        Insert: {
          role_id: number;
          permission_id: number;
          created_at?: string;
        };
        Update: {
          role_id?: number;
          permission_id?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: UserRoleRecord;
        Insert: {
          id?: string;
          user_id: string;
          role_id: number;
          assigned_by?: string | null;
          is_active?: boolean;
          expires_at?: string | null;
          assigned_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role_id?: number;
          assigned_by?: string | null;
          is_active?: boolean;
          expires_at?: string | null;
          assigned_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      programs: {
        Row: ProgramRecord;
        Insert: {
          id?: string;
          code: string;
          slug: string;
          name: string;
          short_description?: string | null;
          description?: string | null;
          type?: ProgramType;
          modality?: ProgramModality;
          duration_text?: string | null;
          duration_hours?: number | null;
          credits?: number | null;
          banner_url?: string | null;
          thumbnail_url?: string | null;
          syllabus_pdf_url?: string | null;
          admission_requirements?: Json;
          graduate_profile?: string | null;
          moodle_category_id?: number | null;
          coordinator_id?: string | null;
          is_featured?: boolean;
          is_active?: boolean;
          display_order?: number;
          seo_title?: string | null;
          seo_description?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          slug?: string;
          name?: string;
          short_description?: string | null;
          description?: string | null;
          type?: ProgramType;
          modality?: ProgramModality;
          duration_text?: string | null;
          duration_hours?: number | null;
          credits?: number | null;
          banner_url?: string | null;
          thumbnail_url?: string | null;
          syllabus_pdf_url?: string | null;
          admission_requirements?: Json;
          graduate_profile?: string | null;
          moodle_category_id?: number | null;
          coordinator_id?: string | null;
          is_featured?: boolean;
          is_active?: boolean;
          display_order?: number;
          seo_title?: string | null;
          seo_description?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_programs: {
        Row: UserProgramRecord;
        Insert: {
          id?: string;
          user_id: string;
          program_id: string;
          status?: AcademicStatus;
          cohort?: string | null;
          progress_percentage?: number;
          authorized_by?: string | null;
          enrolled_at?: string;
          completed_at?: string | null;
          notes?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          program_id?: string;
          status?: AcademicStatus;
          cohort?: string | null;
          progress_percentage?: number;
          authorized_by?: string | null;
          enrolled_at?: string;
          completed_at?: string | null;
          notes?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      course_mappings: {
        Row: CourseMappingRecord;
        Insert: {
          id?: string;
          program_id?: string | null;
          portal_course_code: string;
          slug: string;
          course_name: string;
          course_description?: string | null;
          thumbnail_url?: string | null;
          term_or_module?: number | null;
          is_mandatory?: boolean;
          moodle_course_id: number;
          moodle_shortname: string;
          moodle_category_id?: number | null;
          moodle_course_url?: string | null;
          is_active?: boolean;
          last_synced_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          program_id?: string | null;
          portal_course_code?: string;
          slug?: string;
          course_name?: string;
          course_description?: string | null;
          thumbnail_url?: string | null;
          term_or_module?: number | null;
          is_mandatory?: boolean;
          moodle_course_id?: number;
          moodle_shortname?: string;
          moodle_category_id?: number | null;
          moodle_course_url?: string | null;
          is_active?: boolean;
          last_synced_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      enrollment_requests: {
        Row: EnrollmentRequestRecord;
        Insert: {
          id?: string;
          user_id: string;
          course_mapping_id: string;
          program_id?: string | null;
          moodle_role?: MoodleRoleType;
          status?: EnrollmentStatus;
          requested_by?: string | null;
          authorized_by?: string | null;
          authorized_at?: string | null;
          moodle_enrol_id?: number | null;
          synced_to_moodle_at?: string | null;
          sync_attempts?: number;
          sync_error_message?: string | null;
          cached_progress?: number | null;
          cached_final_grade?: number | null;
          cached_completed?: boolean | null;
          last_moodle_access_at?: string | null;
          access_start_at?: string | null;
          access_end_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          course_mapping_id?: string;
          program_id?: string | null;
          moodle_role?: MoodleRoleType;
          status?: EnrollmentStatus;
          requested_by?: string | null;
          authorized_by?: string | null;
          authorized_at?: string | null;
          moodle_enrol_id?: number | null;
          synced_to_moodle_at?: string | null;
          sync_attempts?: number;
          sync_error_message?: string | null;
          cached_progress?: number | null;
          cached_final_grade?: number | null;
          cached_completed?: boolean | null;
          last_moodle_access_at?: string | null;
          access_start_at?: string | null;
          access_end_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      campus_access_logs: {
        Row: CampusAccessLogRecord;
        Insert: {
          id?: string;
          user_id: string;
          course_mapping_id?: string | null;
          moodle_course_id?: number | null;
          access_method?: string;
          ip_address?: string | null;
          user_agent?: string | null;
          succeeded?: boolean;
          error_detail?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          course_mapping_id?: string | null;
          moodle_course_id?: number | null;
          access_method?: string;
          ip_address?: string | null;
          user_agent?: string | null;
          succeeded?: boolean;
          error_detail?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      admission_applications: {
        Row: AdmissionApplicationRecord;
        Insert: {
          id?: string;
          applicant_id: string;
          program_id: string;
          status?: AcademicStatus;
          previous_education_level?: string | null;
          previous_institution?: string | null;
          average_grade?: number | null;
          motivation_letter?: string | null;
          documents_json?: Json;
          reviewer_id?: string | null;
          reviewer_notes?: string | null;
          reviewed_at?: string | null;
          submitted_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          applicant_id?: string;
          program_id?: string;
          status?: AcademicStatus;
          previous_education_level?: string | null;
          previous_institution?: string | null;
          average_grade?: number | null;
          motivation_letter?: string | null;
          documents_json?: Json;
          reviewer_id?: string | null;
          reviewer_notes?: string | null;
          reviewed_at?: string | null;
          submitted_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      institutional_directory: {
        Row: InstitutionalDirectoryRecord;
        Insert: {
          id?: string;
          profile_id?: string | null;
          full_name: string;
          title_or_position: string;
          department?: string | null;
          category?: string;
          bio?: string | null;
          photo_url?: string | null;
          email_contact?: string | null;
          linkedin_url?: string | null;
          display_order?: number;
          is_visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string | null;
          full_name?: string;
          title_or_position?: string;
          department?: string | null;
          category?: string;
          bio?: string | null;
          photo_url?: string | null;
          email_contact?: string | null;
          linkedin_url?: string | null;
          display_order?: number;
          is_visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cms_contents: {
        Row: CmsContentRecord;
        Insert: {
          id?: string;
          slug: string;
          title: string;
          excerpt?: string | null;
          body_content: string;
          content_type?: CmsContentType;
          status?: CmsContentStatus;
          featured_image_url?: string | null;
          author_id?: string | null;
          published_at?: string | null;
          seo_title?: string | null;
          seo_description?: string | null;
          legacy_wp_id?: number | null;
          legacy_wp_url?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          excerpt?: string | null;
          body_content?: string;
          content_type?: CmsContentType;
          status?: CmsContentStatus;
          featured_image_url?: string | null;
          author_id?: string | null;
          published_at?: string | null;
          seo_title?: string | null;
          seo_description?: string | null;
          legacy_wp_id?: number | null;
          legacy_wp_url?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      contact_messages: {
        Row: ContactMessageRecord;
        Insert: {
          id?: string;
          full_name: string;
          email: string;
          phone?: string | null;
          subject: string;
          program_of_interest?: string | null;
          message: string;
          status?: ContactMessageStatus;
          attended_by?: string | null;
          internal_notes?: string | null;
          ip_address?: string | null;
          attended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          phone?: string | null;
          subject?: string;
          program_of_interest?: string | null;
          message?: string;
          status?: ContactMessageStatus;
          attended_by?: string | null;
          internal_notes?: string | null;
          ip_address?: string | null;
          attended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      wp_migration_inventory: {
        Row: WpMigrationInventoryRecord;
        Insert: {
          id?: string;
          legacy_url: string;
          legacy_title?: string | null;
          asset_type?: string;
          action?: WpMigrationAction;
          new_target_url?: string | null;
          http_redirect_code?: number | null;
          is_redirect_active?: boolean;
          migration_completed?: boolean;
          seo_notes?: string | null;
          verified_by?: string | null;
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          legacy_url?: string;
          legacy_title?: string | null;
          asset_type?: string;
          action?: WpMigrationAction;
          new_target_url?: string | null;
          http_redirect_code?: number | null;
          is_redirect_active?: boolean;
          migration_completed?: boolean;
          seo_notes?: string | null;
          verified_by?: string | null;
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLogRecord;
        Insert: {
          id?: string;
          actor_id?: string | null;
          target_user_id?: string | null;
          action: string;
          entity_name: string;
          entity_id?: string | null;
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          target_user_id?: string | null;
          action?: string;
          entity_name?: string;
          entity_id?: string | null;
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      system_settings: {
        Row: SystemSettingRecord;
        Insert: {
          key: string;
          value: Json;
          description?: string | null;
          is_public?: boolean;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          description?: string | null;
          is_public?: boolean;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      v_user_complete_profile: {
        Row: VUserCompleteProfileRecord;
        Relationships: [];
      };
      v_user_authorized_courses: {
        Row: VUserAuthorizedCourseRecord;
        Relationships: [];
      };
    };
    Functions: {
      has_role: {
        Args: {
          required_role_slug: string;
          target_uid?: string;
        };
        Returns: boolean;
      };
      has_any_role: {
        Args: {
          required_role_slugs: string[];
          target_uid?: string;
        };
        Returns: boolean;
      };
      has_permission: {
        Args: {
          required_permission_code: string;
          target_uid?: string;
        };
        Returns: boolean;
      };
      is_admin: {
        Args: {
          target_uid?: string;
        };
        Returns: boolean;
      };
      get_my_roles: {
        Args: Record<string, unknown>;
        Returns: string[];
      };
    };
    Enums: {
      user_status: UserStatus;
      program_type: ProgramType;
      program_modality: ProgramModality;
      academic_status: AcademicStatus;
      enrollment_status: EnrollmentStatus;
      moodle_role_type: MoodleRoleType;
      sync_status_type: SyncStatusType;
      cms_content_type: CmsContentType;
      cms_content_status: CmsContentStatus;
      wp_migration_action: WpMigrationAction;
      contact_message_status: ContactMessageStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
