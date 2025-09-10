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

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = 'https://xwrhlmtfk9.execute-api.us-east-1.amazonaws.com/prod/api';

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

  // Get all tables
  getTables(): Observable<Table[]> {
    return this.http.get<Table[]>(`${this.baseUrl}/tables`);
  }

  // Get columns for a specific table
  getColumnsByTable(tableId: number): Observable<Column[]> {
    return this.http.get<Column[]>(`${this.baseUrl}/tables/${tableId}/columns`);
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
}
