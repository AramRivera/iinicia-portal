export interface PermissionRecord {
  id: number;
  code: string;
  description: string | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
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
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
