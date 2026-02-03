import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { TableSet, TableSetReorderItem } from '../models/upload-config.model';

@Injectable({ providedIn: 'root' })
export class TableSetsApi {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  listTableSets(): Observable<TableSet[]> {
    return this.http.get<unknown[]>(`${this.baseUrl}/table-sets`).pipe(
      map(items => (items || []).map(item => this.normalizeTableSet(item)))
    );
  }

  createTableSet(body: { name: string; seq_no?: number }): Observable<TableSet> {
    return this.http
      .post<unknown>(`${this.baseUrl}/table-sets`, body)
      .pipe(map(item => this.normalizeTableSet(item)));
  }

  updateTableSet(tableSetId: number, body: { name?: string; seq_no?: number }): Observable<TableSet> {
    return this.http
      .patch<unknown>(`${this.baseUrl}/table-sets/${tableSetId}`, body)
      .pipe(map(item => this.normalizeTableSet(item)));
  }

  reorderTableSets(items: TableSetReorderItem[]): Observable<TableSet[]> {
    return this.http.patch<unknown[]>(`${this.baseUrl}/table-sets/reorder`, { items }).pipe(
      map(items => (items || []).map(item => this.normalizeTableSet(item)))
    );
  }

  deleteTableSet(tableSetId: number): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/table-sets/${tableSetId}`);
  }

  // Normalize backend payloads to `{ id, name, seq_no }`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeTableSet(raw: any): TableSet {
    const id = Number(raw?.id ?? raw?.table_set_id ?? raw?.tableSetId);
    const seqNoRaw = raw?.seq_no ?? raw?.seqNo ?? raw?.seq ?? null;
    const seq_no = seqNoRaw === null || seqNoRaw === undefined ? null : Number(seqNoRaw);

    const nameRaw =
      raw?.name ??
      raw?.Name ??
      raw?.set_name ??
      raw?.setName ??
      raw?.table_set_name ??
      raw?.tableSetName ??
      raw?.display_name ??
      raw?.displayName ??
      '';

    const name = String(nameRaw || '').trim() || `Set ${id}`;
    return { id, name, seq_no: Number.isFinite(seq_no as number) ? (seq_no as number) : null };
  }
}

