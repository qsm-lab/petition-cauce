export interface Category {
  id: string;
  org_id: string | null;
  name: string;
  slug: string;
  color: string | null;
  archived_at: string | null;
  created_at: string;
}

export interface CategoryCreate {
  name: string;
  slug?: string;
  color?: string;
}

export interface CategoryUpdate {
  name?: string;
  slug?: string;
  color?: string;
}
