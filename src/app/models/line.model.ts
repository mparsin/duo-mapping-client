export interface Line {
  id: number;
  categoryid?: number;
  categoryId?: number;
  name?: string;
  Name?: string;
  description?: string;
  Description?: string;
  default?: string;
  customer_settings?: string;
  no_of_chars?: string;
  field_name?: string;
  reason?: string;
  comment?: string;
  sub_category_id?: number;
  table_name?: string;
  column_name?: string;
  table_id?: number;
  column_id?: number;
  exclude?: boolean;
  [key: string]: any; // Allow for additional properties
}



