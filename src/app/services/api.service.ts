import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Category } from '../models/category.model';
import { Line } from '../models/line.model';
import { Table } from '../models/table.model';
import { Column } from '../models/column.model';
import { SubCategory } from '../models/sub-category.model';
import { SearchResult } from '../models/search-result.model';
import { TableMatch } from '../models/table-match.model';
import { environment } from '../../environments/environment';

/** Body for POST /api/categories/{category_id}/lines */
export interface CreateLineBody {
  name: string;
  sub_category_id?: number;
  field_name?: string;
  default?: string;
  reason?: string;
  comment?: string;
  seq_no?: number;
  customer_settings?: string;
  no_of_chars?: string;
  table_id?: number;
  column_id?: number;
  exclude?: boolean;
  iskeyfield?: boolean;
  isfkfield?: boolean;
}

/** Response from GET /api/column-comment */
export interface ColumnCommentResponse {
  table_name: string;
  column_name: string;
  comment: string;
  table_id?: number;
  column_id?: number;
}

/** Body for PATCH /api/lines/{line_id} (any subset of fields) */
export interface LinePatchBody {
  name?: string;
  field_name?: string;
  default?: string;
  reason?: string;
  comment?: string;
  seq_no?: number;
  customer_settings?: string;
  no_of_chars?: string;
  sub_category_id?: number | null;
  table_id?: number | null;
  column_id?: number | null;
  exclude?: boolean;
  iskeyfield?: boolean;
  isfkfield?: boolean;
}

/** Response from GET /api/github-connection */
export interface GithubConnectionResponse {
  configured: boolean;
}

/** Response from PUT/DELETE /api/github-connection */
export interface GithubConnectionStatusResponse {
  status: 'configured' | 'removed';
}

/** Body for POST /api/create-schema-pr (owner, repo, file_path, branch_name, base_branch are server-configured) */
export interface CreateSchemaPrBody {
  author: string;
  pr_title: string;
  pr_body?: string;
}

/** Response from POST /api/create-schema-pr */
export interface CreateSchemaPrResponse {
  pr_url: string;
  pr_number: number;
  branch: string;
  commit_sha: string;
  file_path: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  // Health check
  checkHealth(): Observable<{ status: string }> {
    return this.http.get<{ status: string }>(`${this.baseUrl}/health`);
  }

  // Get all categories
  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.baseUrl}/categories`);
  }

  // Get a single category by ID
  getCategory(categoryId: number): Observable<Category> {
    return this.http.get<Category>(`${this.baseUrl}/categories/${categoryId}`);
  }

  // Get lines for a specific category
  getLinesByCategory(categoryId: number): Observable<Line[]> {
    return this.http.get<Line[]>(`${this.baseUrl}/categories/${categoryId}/lines`);
  }

  // Get a single line by ID (for edit form prefill)
  getLine(lineId: number): Observable<Line> {
    return this.http.get<Line>(`${this.baseUrl}/lines/${lineId}`);
  }

  // Create a new line in a category
  createLine(categoryId: number, body: CreateLineBody): Observable<Line> {
    return this.http.post<Line>(`${this.baseUrl}/categories/${categoryId}/lines`, body);
  }

  // Partial update of a line (send only fields that change)
  patchLine(lineId: number, body: Partial<LinePatchBody>): Observable<Line> {
    return this.http.patch<Line>(`${this.baseUrl}/lines/${lineId}`, body);
  }

  // Get all tables
  getTables(): Observable<Table[]> {
    return this.http.get<Table[]>(`${this.baseUrl}/tables`);
  }

  // Get columns for a specific table
  getColumnsByTable(tableId: number): Observable<Column[]> {
    return this.http.get<Column[]>(`${this.baseUrl}/tables/${tableId}/columns`);
  }

  // Get column comment for initializing Reason field (table_name and column_name required)
  getColumnComment(tableName: string, columnName: string): Observable<ColumnCommentResponse> {
    const params = {
      table_name: tableName,
      column_name: columnName
    };
    return this.http.get<ColumnCommentResponse>(`${this.baseUrl}/column-comment`, { params });
  }

  // Update a line
  updateLine(lineId: number, tableId: number, columnId: number, comment?: string): Observable<Line> {
    const body: any = {
      table_id: tableId,
      column_id: columnId
    };
    if (comment !== undefined) {
      body.comment = comment;
    }
    return this.http.patch<Line>(`${this.baseUrl}/lines/${lineId}`, body);
  }

  // Update a line with exclude field
  updateLineWithExclude(lineId: number, tableId: number, columnId: number, comment?: string, exclude?: boolean): Observable<Line> {
    const body: any = {
      table_id: tableId,
      column_id: columnId
    };
    if (comment !== undefined) {
      body.comment = comment;
    }
    if (exclude !== undefined) {
      body.exclude = exclude;
    }
    return this.http.patch<Line>(`${this.baseUrl}/lines/${lineId}`, body);
  }

  // Update only table for a line (for bulk updates)
  updateLineTable(lineId: number, tableId: number): Observable<Line> {
    const body = {
      table_id: tableId
    };
    return this.http.patch<Line>(`${this.baseUrl}/lines/${lineId}`, body);
  }

  // Update only column for a line (for bulk updates)
  updateLineColumn(lineId: number, columnId: number, tableId: number): Observable<Line> {
    const body = {
      column_id: columnId,
      table_id: tableId
    };
    return this.http.patch<Line>(`${this.baseUrl}/lines/${lineId}`, body);
  }

  // Get sub-categories for a specific category
  getSubCategoriesByCategory(categoryId: number): Observable<SubCategory[]> {
    return this.http.get<SubCategory[]>(`${this.baseUrl}/categories/${categoryId}/sub-categories`);
  }

  // Get all sub-categories
  getSubCategories(): Observable<SubCategory[]> {
    return this.http.get<SubCategory[]>(`${this.baseUrl}/sub-categories`);
  }

  // Update a sub-category
  updateSubCategory(categoryId: number, subCategoryId: number, comment: string): Observable<SubCategory> {
    const body = {
      comment: comment
    };
    return this.http.patch<SubCategory>(`${this.baseUrl}/categories/${categoryId}/sub-categories/${subCategoryId}`, body);
  }

  // Clear table assignment for a line (set table_id to 0)
  clearLineTable(lineId: number): Observable<Line> {
    const body = {
      table_id: 0
    };
    return this.http.patch<Line>(`${this.baseUrl}/lines/${lineId}`, body);
  }

  // Clear column assignment for a line (set column_id to 0)
  clearLineColumn(lineId: number): Observable<Line> {
    const body = {
      column_id: 0
    };
    return this.http.patch<Line>(`${this.baseUrl}/lines/${lineId}`, body);
  }

  // Search columns by column name
  searchColumns(columnName: string): Observable<SearchResult[]> {
    return this.http.get<SearchResult[]>(`${this.baseUrl}/search-columns?columnName=${encodeURIComponent(columnName)}`);
  }

  // Find table matches based on column names
  findTableMatches(columnNames: string[]): Observable<TableMatch[]> {
    const body = { column_names: columnNames };
    return this.http.post<TableMatch[]>(`${this.baseUrl}/find-table-matches`, body);
  }

  // Download generated schema
  downloadSchema(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/download-schema`, {
      responseType: 'blob'
    });
  }

  // Download upload config
  downloadUploadConfig(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/download-upload-config`, {
      responseType: 'blob'
    });
  }

  // Toggle exclude status for a line
  toggleLineExclude(lineId: number, exclude: boolean): Observable<Line> {
    const body = {
      exclude: exclude
    };
    return this.http.patch<Line>(`${this.baseUrl}/lines/${lineId}/exclude`, body);
  }

  // Category-level bulk operations
  excludeCategory(categoryId: number): Observable<Category> {
    return this.http.patch<Category>(`${this.baseUrl}/categories/${categoryId}/exclude`, {});
  }

  includeCategory(categoryId: number): Observable<Category> {
    return this.http.patch<Category>(`${this.baseUrl}/categories/${categoryId}/include`, {});
  }

  // Sub-category-level bulk operations
  excludeSubCategory(categoryId: number, subCategoryId: number): Observable<SubCategory> {
    return this.http.patch<SubCategory>(`${this.baseUrl}/categories/${categoryId}/sub-categories/${subCategoryId}/exclude`, {});
  }

  includeSubCategory(categoryId: number, subCategoryId: number): Observable<SubCategory> {
    return this.http.patch<SubCategory>(`${this.baseUrl}/categories/${categoryId}/sub-categories/${subCategoryId}/include`, {});
  }

  // Category config operations
  updateCategoryConfig(categoryId: number, config: any): Observable<Category> {
    return this.http.patch<Category>(`${this.baseUrl}/categories/${categoryId}/config`, { config });
  }

  createCategoryConfig(categoryId: number, config: any): Observable<Category> {
    return this.http.post<Category>(`${this.baseUrl}/categories/${categoryId}/config`, { config });
  }

  deleteCategoryConfig(categoryId: number): Observable<Category> {
    return this.http.delete<Category>(`${this.baseUrl}/categories/${categoryId}/config`);
  }

  // GitHub connection
  getGithubConnection(): Observable<GithubConnectionResponse> {
    return this.http.get<GithubConnectionResponse>(`${this.baseUrl}/github-connection`);
  }

  setGithubConnection(github_token: string): Observable<GithubConnectionStatusResponse> {
    return this.http.put<GithubConnectionStatusResponse>(`${this.baseUrl}/github-connection`, {
      github_token
    });
  }

  deleteGithubConnection(): Observable<GithubConnectionStatusResponse> {
    return this.http.delete<GithubConnectionStatusResponse>(`${this.baseUrl}/github-connection`);
  }

  createSchemaPr(body: CreateSchemaPrBody): Observable<CreateSchemaPrResponse> {
    return this.http.post<CreateSchemaPrResponse>(`${this.baseUrl}/create-schema-pr`, body);
  }
}
