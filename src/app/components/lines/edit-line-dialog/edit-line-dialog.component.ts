import { Component, Inject, OnInit, signal, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Observable, map, startWith } from 'rxjs';
import { ApiService } from '../../../services/api.service';
import { CategoryRefreshService } from '../../../services/category-refresh.service';
import { Line } from '../../../models/line.model';
import { Table } from '../../../models/table.model';
import { Column } from '../../../models/column.model';
import { SearchResult } from '../../../models/search-result.model';

export interface EditLineDialogData {
  line: Line;
  categoryId?: number;
}

@Component({
  selector: 'app-edit-line-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatAutocompleteModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatIconModule,
    MatTooltipModule,
    ReactiveFormsModule
  ],
  templateUrl: './edit-line-dialog.component.html',
  styleUrl: './edit-line-dialog.component.css'
})
export class EditLineDialogComponent implements OnInit, AfterViewInit {
  editForm: FormGroup;
  tables = signal<Table[]>([]);
  columns = signal<Column[]>([]);
  loadingTables = signal<boolean>(false);
  loadingColumns = signal<boolean>(false);
  searchResults = signal<SearchResult[]>([]);
  selectedSearchResult = signal<SearchResult | null>(null);
  loadingSearch = signal<boolean>(false);

  // Filtered observables for typeahead
  filteredTables$!: Observable<Table[]>;
  filteredColumns$!: Observable<Column[]>;

  // ViewChild references for focus management
  @ViewChild('tableInput') tableInput!: ElementRef<HTMLInputElement>;
  @ViewChild('columnInput') columnInput!: ElementRef<HTMLInputElement>;
  @ViewChild('cancelButton') cancelButton!: ElementRef<HTMLButtonElement>;

  // Control dropdown visibility
  tableDropdownOpen = false;
  columnDropdownOpen = false;

  // Track if user has started typing
  private userTypingTable = false;
  private userTypingColumn = false;

  constructor(
    private dialogRef: MatDialogRef<EditLineDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EditLineDialogData,
    private fb: FormBuilder,
    private apiService: ApiService,
    private categoryRefreshService: CategoryRefreshService,
    private snackBar: MatSnackBar
  ) {
    this.editForm = this.fb.group({
      table_name: [''],
      column_name: [{value: '', disabled: true}],
      comment: ['']
    });
  }

  ngOnInit(): void {
    this.setupFilteredObservables();
    this.loadTables();
  }

  ngAfterViewInit(): void {
    // Set focus after view is initialized
    setTimeout(() => {
      this.setInitialFocus();
    }, 100);
  }

  private setInitialFocus(): void {
    const tableValue = this.editForm.get('table_name')?.value;
    const columnValue = this.editForm.get('column_name')?.value;

    // Check if table name is empty
    if (!tableValue || (typeof tableValue === 'string' && tableValue.trim() === '') ||
        (typeof tableValue === 'object' && !tableValue.name)) {
      this.tableInput?.nativeElement?.focus();
    }
    // Check if table has value but column is empty
    else if (tableValue && (!columnValue || (typeof columnValue === 'string' && columnValue.trim() === '') ||
             (typeof columnValue === 'object' && !columnValue.name))) {
      this.columnInput?.nativeElement?.focus();
    }
    // Both fields have values, focus cancel button
    else {
      this.cancelButton?.nativeElement?.focus();
    }
  }

  private setupFilteredObservables(): void {
    // Setup filtered tables observable
    this.filteredTables$ = this.editForm.get('table_name')!.valueChanges.pipe(
      startWith(''),
      map(value => {
        if (!this.tableDropdownOpen) {
          return [];
        }
        return this.filterTables(value || '');
      })
    );

    // Setup filtered columns observable
    this.filteredColumns$ = this.editForm.get('column_name')!.valueChanges.pipe(
      startWith(''),
      map(value => {
        if (!this.columnDropdownOpen) {
          return [];
        }
        return this.filterColumns(value || '');
      })
    );
  }

  private filterTables(value: string): Table[] {
    const filterValue = value.toLowerCase();
    return this.tables().filter(table =>
      table.name.toLowerCase().includes(filterValue) ||
      table.description.toLowerCase().includes(filterValue)
    );
  }

  private filterColumns(value: string): Column[] {
    const filterValue = value.toLowerCase();
    return this.columns().filter(column =>
      column.name.toLowerCase().includes(filterValue) ||
      column.comment.toLowerCase().includes(filterValue) ||
      column.type.toLowerCase().includes(filterValue)
    );
  }

  private setupFormSubscriptions(): void {
    // Watch for table selection changes
    this.editForm.get('table_name')?.valueChanges.subscribe(value => {
      // Check if the value is a complete table object or just a string
      const tableName = typeof value === 'string' ? value : value?.name;

      if (tableName) {
        const selectedTable = this.tables().find(t => t.name === tableName);
        if (selectedTable) {
          this.loadColumns(selectedTable.id);
          // Enable column dropdown when table is selected
          this.editForm.get('column_name')?.enable();
        }
      } else {
        this.columns.set([]);
        this.editForm.get('column_name')?.setValue('');
        // Disable column dropdown when no table is selected
        this.editForm.get('column_name')?.disable();
      }
    });
  }

  private loadTables(): void {
    this.loadingTables.set(true);
    this.apiService.getTables().subscribe({
      next: (tables) => {
        this.tables.set(tables);
        this.loadingTables.set(false);

        // Set up form subscriptions after tables are loaded
        this.setupFormSubscriptions();

        // Set initial values after tables are loaded and subscriptions are set up
        if (this.data.line.table_name) {
          const initialTable = this.tables().find(t => t.name === this.data.line.table_name);
          if (initialTable) {
            this.editForm.patchValue({
              table_name: initialTable
            });
          } else {
            // If table not found in loaded tables, set as string value
            this.editForm.patchValue({
              table_name: this.data.line.table_name
            });
          }
        }
        if (this.data.line.column_name) {
          this.editForm.patchValue({
            column_name: this.data.line.column_name
          });
        }
        if (this.data.line.comment) {
          this.editForm.patchValue({
            comment: this.data.line.comment
          });
        }
      },
      error: (error) => {
        console.error('Error loading tables:', error);
        this.snackBar.open('Error loading tables', 'Close', {
          duration: 3000
        });
        this.loadingTables.set(false);
      }
    });
  }

  private loadColumns(tableId: number): void {
    this.loadingColumns.set(true);
    this.columns.set([]);
    this.editForm.get('column_name')?.setValue('');
    // Disable column dropdown during loading
    this.editForm.get('column_name')?.disable();

    this.apiService.getColumnsByTable(tableId).subscribe({
      next: (columns) => {
        this.columns.set(columns);
        this.loadingColumns.set(false);
        // Re-enable column dropdown after loading is complete
        this.editForm.get('column_name')?.enable();

        // Set initial column value if it exists and matches a loaded column
        if (this.data.line.column_name) {
          const initialColumn = columns.find(c => c.name === this.data.line.column_name);
          if (initialColumn) {
            this.editForm.patchValue({
              column_name: initialColumn
            });
          } else {
            // If column not found in loaded columns, set as string value
            this.editForm.patchValue({
              column_name: this.data.line.column_name
            });
          }
        }
      },
      error: (error) => {
        console.error('Error loading columns:', error);
        this.snackBar.open('Error loading columns', 'Close', {
          duration: 3000
        });
        this.loadingColumns.set(false);
        // Keep column dropdown disabled on error
        this.editForm.get('column_name')?.disable();
      }
    });
  }

  onTableInputFocus(): void {
    // Only show dropdown if user has started typing
    if (this.userTypingTable) {
      this.tableDropdownOpen = true;
      this.editForm.get('table_name')?.updateValueAndValidity();
    }
  }

  onTableInputBlur(): void {
    // Delay to allow option selection
    setTimeout(() => {
      this.tableDropdownOpen = false;
    }, 150);
  }

  onTableInputChange(): void {
    // User has started typing, enable dropdown
    this.userTypingTable = true;
    this.tableDropdownOpen = true;
    this.editForm.get('table_name')?.updateValueAndValidity();
  }

  onColumnInputFocus(): void {
    // Only show dropdown if user has started typing
    if (this.userTypingColumn) {
      this.columnDropdownOpen = true;
      this.editForm.get('column_name')?.updateValueAndValidity();
    }
  }

  onColumnInputBlur(): void {
    // Delay to allow option selection
    setTimeout(() => {
      this.columnDropdownOpen = false;
    }, 150);
  }

  onColumnInputChange(): void {
    // User has started typing, enable dropdown
    this.userTypingColumn = true;
    this.columnDropdownOpen = true;
    this.editForm.get('column_name')?.updateValueAndValidity();
  }

  getLineDisplayName(): string {
    const line = this.data.line;
    // Try different possible name fields
    const name = line.name || line.Name || line.description || line.Description;

    if (name && name.trim()) {
      return name.trim();
    }

    // Fallback to field name or ID
    if (line.field_name && line.field_name.trim()) {
      return line.field_name.trim();
    }

    return `ID: ${line.id}`;
  }

  getLineFieldName(): string {
    const line = this.data.line;
    return line.field_name ?? ''
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onTableSelected(table: Table): void {
    this.editForm.patchValue({ table_name: table });
    // Reset typing flag after selection
    this.userTypingTable = false;
    this.tableDropdownOpen = false;
  }

  onColumnSelected(column: Column): void {
    this.editForm.patchValue({ column_name: column });
    // Reset typing flag after selection
    this.userTypingColumn = false;
    this.columnDropdownOpen = false;
  }

  displayTableName(table: Table | string): string {
    if (typeof table === 'string') {
      return table;
    }
    return table ? table.name : '';
  }

  displayColumnName(column: Column | string): string {
    if (typeof column === 'string') {
      return column;
    }
    return column ? column.name : '';
  }

  onAutoMatchColumn(): void {
    const fieldName = this.data.line.field_name;
    if (!fieldName || !fieldName.trim()) {
      this.snackBar.open('No field name available to match', 'Close', {
        duration: 3000
      });
      return;
    }

    const availableColumns = this.columns();
    if (availableColumns.length === 0) {
      this.snackBar.open('No columns available to match', 'Close', {
        duration: 3000
      });
      return;
    }

    // Try to find an exact match (case insensitive)
    const fieldNameLower = fieldName.toLowerCase().trim();
    const exactMatch = availableColumns.find(column =>
      column.name.toLowerCase().trim() === fieldNameLower
    );

    if (exactMatch) {
      // Set the column form control to the matched column
      this.editForm.patchValue({ column_name: exactMatch });
      this.onColumnSelected(exactMatch);
      this.snackBar.open(`Matched column: ${exactMatch.name}`, 'Close', {
        duration: 2000
      });
    } else {
      // Try partial match if no exact match found
      const partialMatch = availableColumns.find(column =>
        column.name.toLowerCase().includes(fieldNameLower) ||
        fieldNameLower.includes(column.name.toLowerCase())
      );

      if (partialMatch) {
        this.editForm.patchValue({ column_name: partialMatch });
        this.onColumnSelected(partialMatch);
        this.snackBar.open(`Partial match found: ${partialMatch.name}`, 'Close', {
          duration: 2000
        });
      } else {
        this.snackBar.open('No matching column found', 'Close', {
          duration: 3000
        });
      }
    }
  }

  isAutoMatchEnabled(): boolean {
    // Enable auto-match when:
    // 1. Table is selected (has value)
    // 2. Field name exists
    // 3. Columns are loaded and available
    const tableValue = this.editForm.get('table_name')?.value;
    const hasTable = tableValue && (typeof tableValue === 'object' ? tableValue.id : tableValue);
    const hasFieldName = this.data.line.field_name && this.data.line.field_name.trim();
    const hasColumns = this.columns().length > 0 && !this.loadingColumns();

    return !!(hasTable && hasFieldName && hasColumns);
  }

  onClearColumn(): void {
    this.editForm.patchValue({ column_name: '' });
    // Reset the typing flag
    this.userTypingColumn = false;
    this.columnDropdownOpen = false;

    this.snackBar.open('Column cleared', 'Close', {
      duration: 2000
    });
  }

  onClearTable(): void {
    // Clear both table and column since column depends on table
    this.editForm.patchValue({
      table_name: '',
      column_name: ''
    });

    // Reset columns array
    this.columns.set([]);

    // Disable column field
    this.editForm.get('column_name')?.disable();

    // Reset typing flags
    this.userTypingTable = false;
    this.userTypingColumn = false;
    this.tableDropdownOpen = false;
    this.columnDropdownOpen = false;

    this.snackBar.open('Table and column cleared', 'Close', {
      duration: 2000
    });
  }

  isClearColumnEnabled(): boolean {
    const columnValue = this.editForm.get('column_name')?.value;
    return !!(columnValue && (typeof columnValue === 'object' ? columnValue.id : columnValue));
  }

  isClearTableEnabled(): boolean {
    const tableValue = this.editForm.get('table_name')?.value;
    return !!(tableValue && (typeof tableValue === 'object' ? tableValue.id : tableValue));
  }

  onSave(): void {
    const formValue = this.editForm.value;

    // Get table_id and column_id from the selected objects
    // If no value is selected, send 0 to clear the field on the server
    let tableId: number | undefined;
    let columnId: number | undefined;

    if (formValue.table_name) {
      tableId = typeof formValue.table_name === 'object'
        ? formValue.table_name?.id
        : this.tables().find(t => t.name === formValue.table_name)?.id;
    }

    if (formValue.column_name) {
      columnId = typeof formValue.column_name === 'object'
        ? formValue.column_name?.id
        : this.columns().find(c => c.name === formValue.column_name)?.id;
    }

    // Use 0 to clear the value on the server if nothing is selected
    const tableIdToSend = tableId || 0;
    const columnIdToSend = columnId || 0;

    // Get comment value from form
    const commentValue = formValue.comment || '';

    // Send PATCH request to /api/lines/{line_id}
    this.apiService.updateLine(this.data.line.id, tableIdToSend, columnIdToSend, commentValue).subscribe({
      next: (savedLine) => {
        // Create updated line object with the new table and column names
        const updatedLine: Line = {
          ...this.data.line,
          table_name: typeof formValue.table_name === 'string'
            ? formValue.table_name
            : formValue.table_name?.name || '',
          column_name: typeof formValue.column_name === 'string'
            ? formValue.column_name
            : formValue.column_name?.name || '',
          table_id: tableId,
          column_id: columnId,
          comment: commentValue
        };

        this.snackBar.open('Line saved successfully', 'Close', {
          duration: 2000
        });

        // Trigger category refresh if categoryId is available
        if (this.data.categoryId) {
          this.categoryRefreshService.refreshCategory(this.data.categoryId);
        }

        this.dialogRef.close(updatedLine);
      },
      error: (error) => {
        console.error('Error saving line:', error);
        this.snackBar.open('Error saving line', 'Close', {
          duration: 3000
        });
      }
    });
  }

  onSearchColumns(): void {
    const fieldName = this.data.line.field_name;
    if (!fieldName || !fieldName.trim()) {
      this.snackBar.open('No field name available to search', 'Close', {
        duration: 3000
      });
      return;
    }

    this.loadingSearch.set(true);
    this.searchResults.set([]);
    this.selectedSearchResult.set(null);

    this.apiService.searchColumns(fieldName).subscribe({
      next: (results) => {
        this.searchResults.set(results);
        this.loadingSearch.set(false);

        if (results.length === 0) {
          this.snackBar.open('No matching columns found', 'Close', {
            duration: 3000
          });
        } else {
          this.snackBar.open(`Found ${results.length} matching columns`, 'Close', {
            duration: 2000
          });
        }
      },
      error: (error) => {
        console.error('Error searching columns:', error);
        this.snackBar.open('Error searching columns', 'Close', {
          duration: 3000
        });
        this.loadingSearch.set(false);
      }
    });
  }

  onSearchResultSelected(result: SearchResult): void {
    this.selectedSearchResult.set(result);

    // Find the table in the loaded tables
    const table = this.tables().find(t => t.name === result.table_name);
    if (table) {
      // Set the table in the form
      this.editForm.patchValue({ table_name: table });

      // Load columns for this table
      this.loadColumns(table.id);

      // After columns are loaded, find and set the column
      setTimeout(() => {
        const column = this.columns().find(c => c.name === result.column_name);
        if (column) {
          this.editForm.patchValue({ column_name: column });
        } else {
          // If column not found in loaded columns, set as string value
          this.editForm.patchValue({ column_name: result.column_name });
        }
      }, 500); // Give time for columns to load
    } else {
      // If table not found, set as string values
      this.editForm.patchValue({
        table_name: result.table_name,
        column_name: result.column_name
      });
    }

    this.snackBar.open(`Selected: ${result.column_name} from ${result.table_name}`, 'Close', {
      duration: 2000
    });
  }

  isSearchEnabled(): boolean {
    const fieldName = this.data.line.field_name;
    return !!(fieldName && fieldName.trim());
  }


}
