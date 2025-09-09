export interface SearchResult {
  column_name: string;
  table_name: string;
  column_id: number;
  table_id: number;
  match_type: 'exact' | 'partial';
}




