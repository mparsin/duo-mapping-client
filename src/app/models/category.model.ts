import { Line } from './line.model';

export interface Category {
  id: number;
  Name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  lines?: Line[];
  percent_mapped?: number;
  tab?: string;
  epic?: string;
  config?: any;
  // Upload-config editor metadata
  table_set_id?: number | null;
  line_no?: number | null;
  isaiload?: boolean;
}


