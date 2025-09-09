import { Injectable, signal, computed, Signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ApiService } from './api.service';
import { TableMatch } from '../models/table-match.model';
import { Line } from '../models/line.model';
import { Table } from '../models/table.model';

export interface TableSuggestionState {
  loading: boolean;
  suggestions: TableMatch[];
  visible: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TableSuggestionService {
  private suggestionStates = new Map<string, {
    loading: ReturnType<typeof signal<boolean>>;
    suggestions: ReturnType<typeof signal<TableMatch[]>>;
    visible: ReturnType<typeof signal<boolean>>;
  }>();

  constructor(private apiService: ApiService) {}

  private initializeState(key: string): void {
    if (!this.suggestionStates.has(key)) {
      this.suggestionStates.set(key, {
        loading: signal(false),
        suggestions: signal<TableMatch[]>([]),
        visible: signal(false)
      });
    }
  }

  getState(key: string): TableSuggestionState {
    this.initializeState(key);
    const state = this.suggestionStates.get(key)!;
    return {
      loading: state.loading(),
      suggestions: state.suggestions(),
      visible: state.visible()
    };
  }

  getLoadingSignal(key: string): Signal<boolean> {
    this.initializeState(key);
    return this.suggestionStates.get(key)!.loading.asReadonly();
  }

  getSuggestionsSignal(key: string): Signal<TableMatch[]> {
    this.initializeState(key);
    return this.suggestionStates.get(key)!.suggestions.asReadonly();
  }

  getVisibleSignal(key: string): Signal<boolean> {
    this.initializeState(key);
    return this.suggestionStates.get(key)!.visible.asReadonly();
  }

  setState(key: string, updates: Partial<TableSuggestionState>): void {
    this.initializeState(key);
    const state = this.suggestionStates.get(key)!;
    
    if (updates.loading !== undefined) {
      state.loading.set(updates.loading);
    }
    if (updates.suggestions !== undefined) {
      state.suggestions.set(updates.suggestions);
      console.log(`TableSuggestionService: Set ${updates.suggestions.length} suggestions for key ${key}`, updates.suggestions);
    }
    if (updates.visible !== undefined) {
      state.visible.set(updates.visible);
      console.log(`TableSuggestionService: Set visible=${updates.visible} for key ${key}`);
    }
  }

  collectColumnNamesFromLines(lines: Line[]): string[] {
    return [...new Set(
      lines
        .map(l => l.field_name)
        .filter((fieldName): fieldName is string => !!fieldName && fieldName.trim() !== '')
    )];
  }

  suggestTables(key: string, lines: Line[]): Observable<TableMatch[]> {
    const columnNames = this.collectColumnNamesFromLines(lines);
    
    if (columnNames.length === 0) {
      return of([]);
    }

    this.setState(key, { loading: true, suggestions: [], visible: false });

    return new Observable(observer => {
      this.apiService.findTableMatches(columnNames).subscribe({
        next: (matches) => {
          // Add total_columns to each match
          const matchesWithTotal = matches.map(match => ({
            ...match,
            total_columns: columnNames.length
          }));
          const sortedMatches = matchesWithTotal.sort((a, b) => b.match_count - a.match_count);
          this.setState(key, { 
            loading: false, 
            suggestions: sortedMatches, 
            visible: true 
          });
          observer.next(sortedMatches);
          observer.complete();
        },
        error: (error) => {
          this.setState(key, { loading: false, suggestions: [], visible: false });
          observer.error(error);
        }
      });
    });
  }

  selectTable(key: string, tableMatch: TableMatch, tables: Table[]): Table | null {
    const table = tables.find(t => t.name === tableMatch.table_name);
    if (table) {
      this.closeSuggestions(key);
      return table;
    }
    return null;
  }

  closeSuggestions(key: string): void {
    this.setState(key, { visible: false, suggestions: [] });
  }

  clearState(key: string): void {
    this.suggestionStates.delete(key);
  }
}

