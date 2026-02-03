import { Category } from './category.model';

export interface TableSet {
  id: number;
  name: string;
  seq_no: number | null;
}

export type UploadTableConfig = {
  table?: string;
  batch_size?: number;
  endpoint?: string;
  related_tables?: unknown[] | null;
  [key: string]: unknown;
};

// Backend may include categories grouped under each set.
export interface TableSetWithCategories extends TableSet {
  categories?: Category[];
}

export interface UploadConfigEditorPayload {
  sets: TableSetWithCategories[];
  unassigned: Category[];
  generated_at?: string;
}

export interface TableSetReorderItem {
  id: number;
  seq_no: number;
}

export interface CategoryUploadOrderItem {
  category_id: number;
  table_set_id: number | null;
  line_no: number | null;
}

