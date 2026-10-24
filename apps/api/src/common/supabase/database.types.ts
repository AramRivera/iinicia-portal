export interface PermissionRecord {
  id: number;
  code: string;
  description: string | null;
  created_at: string;
}

export type ProgramType = 'degree' | 'diploma' | 'certification' | 'course';

export interface ProgramRecord {
  id: string;
  code: string;
  slug: string;
  name: string;
  type: ProgramType;
  summary: string | null;
  description: string | null;
  duration_hours: number | null;
  is_published: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type PublicProgramRecord = Pick<
  ProgramRecord,
  | 'id'
  | 'code'
  | 'slug'
  | 'name'
  | 'type'
  | 'summary'
  | 'description'
  | 'duration_hours'
>;

export interface Database {
  public: {
    Tables: {
      programs: {
        Row: ProgramRecord;
        Insert: {
          id?: string;
          code: string;
          slug: string;
          name: string;
          type: ProgramType;
          summary?: string | null;
          description?: string | null;
          duration_hours?: number | null;
          is_published?: boolean;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          code?: string;
          slug?: string;
          name?: string;
          type?: ProgramType;
          summary?: string | null;
          description?: string | null;
          duration_hours?: number | null;
          is_published?: boolean;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      permissions: {
        Row: PermissionRecord;
        Insert: {
          id?: number;
          code: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          code?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      program_type: ProgramType;
    };
    CompositeTypes: Record<string, never>;
  };
}
