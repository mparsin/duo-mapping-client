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
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Observable, map, startWith } from 'rxjs';
import { ApiService } from '../../../services/api.service';
import { Line } from '../../../models/line.model';
import { Table } from '../../../models/table.model';
import { Column } from '../../../models/column.model';

export interface EditLineDialogData {
  line: Line;
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
    private snackBar: MatSnackBar
  ) {
    this.editForm = this.fb.group({
      table_name: ['', Validators.required],
      column_name: [{value: '', disabled: true}, Validators.required]
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
    return table ? `${table.name} - ${table.description}` : '';
  }

  displayColumnName(column: Column | string): string {
    if (typeof column === 'string') {
      return column;
    }
    return column ? column.name : '';
  }

  findMatchingColumn(): void {
    const fieldName = this.data.line.field_name;
    
    if (!fieldName || fieldName.trim() === '') {
      this.snackBar.open('No field name available to match', 'Close', {
        duration: 3000
      });
      return;
    }

    if (this.columns().length === 0) {
      this.snackBar.open('No columns loaded to search', 'Close', {
        duration: 3000
      });
      return;
    }

    // Normalize the field name for comparison
    const normalizedFieldName = fieldName.toLowerCase().trim();
    
    // Try to find exact match first
    let matchedColumn = this.columns().find(column => 
      column.name.toLowerCase() === normalizedFieldName
    );

    // If no exact match, try partial match
    if (!matchedColumn) {
      matchedColumn = this.columns().find(column => 
        column.name.toLowerCase().includes(normalizedFieldName) ||
        normalizedFieldName.includes(column.name.toLowerCase())
      );
    }

    // If still no match, try matching with underscores/hyphens replaced with spaces
    if (!matchedColumn) {
      const fieldNameWithSpaces = normalizedFieldName.replace(/[_-]/g, ' ');
      matchedColumn = this.columns().find(column => {
        const columnNameWithSpaces = column.name.toLowerCase().replace(/[_-]/g, ' ');
        return columnNameWithSpaces === fieldNameWithSpaces ||
               columnNameWithSpaces.includes(fieldNameWithSpaces) ||
               fieldNameWithSpaces.includes(columnNameWithSpaces);
      });
    }

    if (matchedColumn) {
      this.editForm.patchValue({ column_name: matchedColumn });
      this.snackBar.open(`Found matching column: ${matchedColumn.name}`, 'Close', {
        duration: 2000
      });
      // Focus on the column input to show the selection
      this.columnInput?.nativeElement?.focus();
    } else {
      this.snackBar.open('No matching column found', 'Close', {
        duration: 3000
      });
    }
  }

  onSave(): void {
    if (this.editForm.valid) {
      const formValue = this.editForm.value;
      
      // Get table_id and column_id from the selected objects
      const tableId = typeof formValue.table_name === 'object' 
        ? formValue.table_name?.id 
        : this.tables().find(t => t.name === formValue.table_name)?.id;
      
      const columnId = typeof formValue.column_name === 'object' 
        ? formValue.column_name?.id 
        : this.columns().find(c => c.name === formValue.column_name)?.id;

      // Send PATCH request to /api/lines/{line_id}
      this.apiService.updateLine(this.data.line.id, tableId!, columnId!).subscribe({
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
            column_id: columnId
          };
          
          this.snackBar.open('Line saved successfully', 'Close', {
            duration: 2000
          });
          this.dialogRef.close(updatedLine);
        },
        error: (error) => {
          console.error('Error saving line:', error);
          this.snackBar.open('Error saving line', 'Close', {
            duration: 3000
          });
        }
      });
    } else {
      this.snackBar.open('Please fill in all required fields', 'Close', {
        duration: 3000
      });
    }
  }

}
