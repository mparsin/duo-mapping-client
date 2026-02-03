import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Category } from '../models/category.model';
import { CategoryUploadOrderItem, UploadConfigEditorPayload } from '../models/upload-config.model';

@Injectable({ providedIn: 'root' })
export class UploadConfigApi {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getEditorData(): Observable<UploadConfigEditorPayload> {
    return this.http.get<UploadConfigEditorPayload>(`${this.baseUrl}/upload-config/editor`);
  }

  // Fallback if editor endpoint is unavailable / incomplete
  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.baseUrl}/categories`);
  }

  updateCategoryUploadMetadata(
    categoryId: number,
    body: { table_set_id: number | null; line_no: number | null; Name?: string }
  ): Observable<Category> {
    return this.http.patch<Category>(`${this.baseUrl}/categories/${categoryId}/upload-metadata`, body);
  }

  reorderUploadOrder(items: CategoryUploadOrderItem[]): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/categories/upload-order`, { items });
  }

  updateCategoryConfig(categoryId: number, config: unknown): Observable<Category> {
    return this.http.patch<Category>(`${this.baseUrl}/categories/${categoryId}/config`, { config });
  }

  previewUploadConfigText(): Observable<string> {
    return this.http.get(`${this.baseUrl}/download-upload-config`, { responseType: 'text' });
  }

  downloadUploadConfigBlob(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/download-upload-config`, { responseType: 'blob' });
  }
}

