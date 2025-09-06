import { Component, OnInit, signal, computed, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Observable, map, startWith, forkJoin, of, catchError } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { Line } from '../../models/line.model';
import { Table } from '../../models/table.model';
import { Column } from '../../models/column.model';
import { SubCategory } from '../../models/sub-category.model';
import { EditLineDialogComponent } from './edit-line-dialog/edit-line-dialog.component';

@Component({
  selector: 'app-lines',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatToolbarModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatAutocompleteModule,
    MatCardModule,
    MatDividerModule,
    ReactiveFormsModule
  ],
  templateUrl: './lines.component.html',
  styleUrl: './lines.component.css'
})
export class LinesComponent implements OnInit, OnChanges {
  @Input() categoryId: number | null = null;
  @Input() categoryName: string = '';
  @Input() showToolbar: boolean = true;

  lines = signal<Line[]>([]);
  tables = signal<Table[]>([]);
  columns = signal<Column[]>([]);
  subCategories = signal<SubCategory[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  groupBySubCategory = signal<boolean>(false);
  bulkUpdating = signal<boolean>(false);
  bulkUpdatingColumns = signal<boolean>(false);
  selectedTableId = signal<number | null>(null);
  bulkUpdateProgress = signal<{ completed: number, total: number, failed: number }>({ completed: 0, total: 0, failed: 0 });
  columnBulkUpdateProgress = signal<{ completed: number, total: number, failed: number }>({ completed: 0, total: 0, failed: 0 });

  // Form for bulk update
  bulkUpdateForm: FormGroup;

  // Typeahead functionality
  filteredTables$!: Observable<Table[]>;
  tableDropdownOpen = false;
  private userTypingTable = false;

  displayedColumns: string[] = ['id', 'name', 'field_name', 'table_name', 'column_name', 'default', 'reason'];

  // Computed properties for bulk update functionality
  linesWithoutTable = computed(() => 
    this.lines().filter(line => !line.table_id && !line.table_name)
  );

  linesWithoutColumn = computed(() => 
    this.lines().filter(line => 
      line.table_id && !line.column_id && line.field_name
    )
  );

  // Computed property for grouping lines by sub-category
  groupedLines = computed(() => {
    if (!this.groupBySubCategory()) {
      return { 'All Lines': this.lines() };
    }

    const grouped = new Map<string, Line[]>();
    
    this.lines().forEach(line => {
      const subCategoryId = line.sub_category_id;
      let groupKey = 'Uncategorized';
      
      if (subCategoryId) {
        const subCategory = this.subCategories().find(sc => sc.id === subCategoryId);
        groupKey = subCategory ? subCategory.name : `Sub-category ${subCategoryId}`;
      }
      
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, []);
      }
      grouped.get(groupKey)!.push(line);
    });

    // Convert Map to object for easier template iteration
    const result: { [key: string]: Line[] } = {};
    grouped.forEach((lines, key) => {
      result[key] = lines;
    });
    
    return result;
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private fb: FormBuilder
  ) {
    this.bulkUpdateForm = this.fb.group({
      table_name: ['']
    });
  }

  ngOnInit(): void {
    // Setup typeahead functionality
    this.setupFilteredObservables();
    
    // Load tables for bulk update functionality
    this.loadTables();
    
    // If categoryId is provided as input, load lines immediately
    if (this.categoryId) {
      this.loadLines(this.categoryId);
    } else {
      // Otherwise, use route parameters (for standalone usage)
      this.route.params.subscribe(params => {
        const id = +params['id'];
        if (id) {
          this.loadLines(id);
        }
      });

      this.route.queryParams.subscribe(params => {
        if (params['categoryName']) {
          this.categoryName = params['categoryName'];
        }
      });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['categoryId'] && this.categoryId) {
      this.loadLines(this.categoryId);
    }
  }

  loadLines(categoryId: number): void {
    this.loading.set(true);
    this.error.set(null);

    // Load both lines and sub-categories in parallel
    forkJoin({
      lines: this.apiService.getLinesByCategory(categoryId),
      subCategories: this.apiService.getSubCategoriesByCategory(categoryId).pipe(
        catchError(error => {
          console.warn('Error loading sub-categories:', error);
          return of([]); // Return empty array if sub-categories fail to load
        })
      )
    }).subscribe({
      next: (data) => {
        console.log('Received lines data:', data.lines);
        console.log('Received sub-categories data:', data.subCategories);
        console.log('First line sample:', data.lines[0]);
        this.lines.set(data.lines);
        this.subCategories.set(data.subCategories);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading lines:', error);
        this.error.set('Failed to load lines. Please try again.');
        this.loading.set(false);
        this.snackBar.open('Error loading lines', 'Close', {
          duration: 3000,
          horizontalPosition: 'right',
          verticalPosition: 'top'
        });
      }
    });
  }

  private setupFilteredObservables(): void {
    // Setup filtered tables observable
    this.filteredTables$ = this.bulkUpdateForm.get('table_name')!.valueChanges.pipe(
      startWith(''),
      map(value => {
        if (!this.tableDropdownOpen) {
          return [];
        }
        return this.filterTables(value || '');
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

  loadTables(): void {
    this.apiService.getTables().subscribe({
      next: (tables) => {
        this.tables.set(tables);
      },
      error: (error) => {
        console.error('Error loading tables:', error);
        this.snackBar.open('Error loading tables', 'Close', {
          duration: 3000,
          horizontalPosition: 'right',
          verticalPosition: 'top'
        });
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  refreshLines(): void {
    if (this.categoryId) {
      this.loadLines(this.categoryId);
    }
  }

  toggleGroupBySubCategory(): void {
    this.groupBySubCategory.set(!this.groupBySubCategory());
  }

  getGroupKeys(): string[] {
    return Object.keys(this.groupedLines());
  }

  getStatusColor(status: string | undefined): string {
    switch (status) {
      case 'active': return 'primary';
      case 'inactive': return 'warn';
      case 'pending': return 'accent';
      default: return '';
    }
  }

  openEditDialog(line: Line): void {
    const dialogRef = this.dialog.open(EditLineDialogComponent, {
      width: '500px',
      data: { line: line }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Update the line in the local array
        const currentLines = this.lines();
        const index = currentLines.findIndex(l => l.id === line.id);
        if (index !== -1) {
          currentLines[index] = { ...currentLines[index], ...result };
          this.lines.set([...currentLines]);
        }
        
        // Note: Success message is now handled in the dialog component
        // No need to show another success message here
      }
    });
  }

  // Typeahead event handlers
  onTableInputFocus(): void {
    if (this.userTypingTable) {
      this.tableDropdownOpen = true;
      this.bulkUpdateForm.get('table_name')?.updateValueAndValidity();
    }
  }

  onTableInputBlur(): void {
    setTimeout(() => {
      this.tableDropdownOpen = false;
    }, 150);
  }

  onTableInputChange(): void {
    this.userTypingTable = true;
    this.tableDropdownOpen = true;
    this.bulkUpdateForm.get('table_name')?.updateValueAndValidity();
  }

  onTableSelected(table: Table): void {
    this.bulkUpdateForm.patchValue({ table_name: table });
    this.selectedTableId.set(table.id);
    this.userTypingTable = false;
    this.tableDropdownOpen = false;
  }

  displayTableName(table: Table | string): string {
    if (typeof table === 'string') {
      return table;
    }
    return table ? `${table.name} - ${table.description}` : '';
  }

  bulkUpdateTableForLines(): void {
    const categoryId = this.categoryId;
    const formValue = this.bulkUpdateForm.value;
    
    // Get table_id from the selected object
    const tableId = typeof formValue.table_name === 'object' 
      ? formValue.table_name?.id 
      : this.tables().find(t => t.name === formValue.table_name)?.id;
    
    if (!categoryId || !tableId) {
      this.snackBar.open('Please select a table first', 'Close', {
        duration: 3000,
        horizontalPosition: 'right',
        verticalPosition: 'top'
      });
      return;
    }

    const linesToUpdate = this.linesWithoutTable();
    if (linesToUpdate.length === 0) {
      this.snackBar.open('No lines without table found to update', 'Close', {
        duration: 3000,
        horizontalPosition: 'right',
        verticalPosition: 'top'
      });
      return;
    }

    this.bulkUpdating.set(true);
    this.bulkUpdateProgress.set({ completed: 0, total: linesToUpdate.length, failed: 0 });

    // Update lines individually with only table_id
    this.updateLinesIndividually(linesToUpdate, tableId);
  }

  private updateLinesIndividually(linesToUpdate: Line[], tableId: number): void {
    // Create an array of update requests - only update table_id
    const updateRequests = linesToUpdate.map(line => 
      this.apiService.updateLineTable(line.id, tableId).pipe(
        catchError(error => {
          console.error(`Error updating line ${line.id}:`, error);
          return of({ error: true, lineId: line.id });
        })
      )
    );

    // Execute all requests in parallel
    forkJoin(updateRequests).subscribe({
      next: (results) => {
        this.bulkUpdating.set(false);
        
        const successful = results.filter(result => !result.error);
        const failed = results.filter(result => result.error);
        
        this.bulkUpdateProgress.set({ 
          completed: successful.length, 
          total: linesToUpdate.length, 
          failed: failed.length 
        });

        // Show success message
        if (successful.length > 0) {
          this.snackBar.open(
            `Successfully updated ${successful.length} line(s)${failed.length > 0 ? `, ${failed.length} failed` : ''}`, 
            'Close', 
            {
              duration: 5000,
              horizontalPosition: 'right',
              verticalPosition: 'top'
            }
          );
        } else {
          this.snackBar.open('Failed to update any lines', 'Close', {
            duration: 3000,
            horizontalPosition: 'right',
            verticalPosition: 'top'
          });
        }
        
        // Clear the form and refresh the lines
        this.bulkUpdateForm.patchValue({ table_name: '' });
        this.selectedTableId.set(null);
        this.refreshLines();
      },
      error: (error) => {
        console.error('Error in bulk update:', error);
        this.bulkUpdating.set(false);
        this.snackBar.open('Error updating lines. Please try again.', 'Close', {
          duration: 3000,
          horizontalPosition: 'right',
          verticalPosition: 'top'
        });
      }
    });
  }

  bulkUpdateColumnsForLines(): void {
    const linesToUpdate = this.linesWithoutColumn();
    
    if (linesToUpdate.length === 0) {
      this.snackBar.open('No lines found that need column updates', 'Close', {
        duration: 3000,
        horizontalPosition: 'right',
        verticalPosition: 'top'
      });
      return;
    }

    this.bulkUpdatingColumns.set(true);
    this.columnBulkUpdateProgress.set({ completed: 0, total: linesToUpdate.length, failed: 0 });

    // Group lines by table_id to load columns for each table
    const linesByTable = this.groupLinesByTable(linesToUpdate);
    this.updateColumnsForTables(linesByTable);
  }

  private groupLinesByTable(lines: Line[]): Map<number, Line[]> {
    const grouped = new Map<number, Line[]>();
    lines.forEach(line => {
      if (line.table_id) {
        if (!grouped.has(line.table_id)) {
          grouped.set(line.table_id, []);
        }
        grouped.get(line.table_id)!.push(line);
      }
    });
    return grouped;
  }

  private updateColumnsForTables(linesByTable: Map<number, Line[]>): void {
    const tableIds = Array.from(linesByTable.keys());
    const columnRequests = tableIds.map(tableId => 
      this.apiService.getColumnsByTable(tableId).pipe(
        map(columns => ({ tableId, columns, error: false })),
        catchError(error => {
          console.error(`Error loading columns for table ${tableId}:`, error);
          return of({ tableId, columns: [], error: true });
        })
      )
    );

    forkJoin(columnRequests).subscribe({
      next: (results) => {
        const updateRequests = results.map(result => {
          if (result.error) {
            const linesForTable = linesByTable.get(result.tableId) || [];
            return of({ updated: 0, failed: linesForTable.length });
          }

          const linesForTable = linesByTable.get(result.tableId) || [];
          return this.updateColumnsForTable(linesForTable, result.columns);
        });

        forkJoin(updateRequests).subscribe({
          next: (updateResults) => {
            const totalUpdated = updateResults.reduce((sum, result) => sum + result.updated, 0);
            const totalFailed = updateResults.reduce((sum, result) => sum + result.failed, 0);

            this.bulkUpdatingColumns.set(false);
            this.columnBulkUpdateProgress.set({ 
              completed: totalUpdated, 
              total: linesByTable.size > 0 ? Array.from(linesByTable.values()).flat().length : 0, 
              failed: totalFailed 
            });

            this.snackBar.open(
              `Successfully updated ${totalUpdated} column(s)${totalFailed > 0 ? `, ${totalFailed} failed` : ''}`, 
              'Close', 
              {
                duration: 5000,
                horizontalPosition: 'right',
                verticalPosition: 'top'
              }
            );

            // Refresh the lines to show updated data
            this.refreshLines();
          },
          error: (error) => {
            console.error('Error in column updates:', error);
            this.bulkUpdatingColumns.set(false);
            this.snackBar.open('Error updating columns. Please try again.', 'Close', {
              duration: 3000,
              horizontalPosition: 'right',
              verticalPosition: 'top'
            });
          }
        });
      },
      error: (error) => {
        console.error('Error in column bulk update:', error);
        this.bulkUpdatingColumns.set(false);
        this.snackBar.open('Error loading columns. Please try again.', 'Close', {
          duration: 3000,
          horizontalPosition: 'right',
          verticalPosition: 'top'
        });
      }
    });
  }

  private updateColumnsForTable(lines: Line[], columns: Column[]): Observable<{ updated: number, failed: number }> {
    const updateRequests: Observable<{ success: boolean, lineId: number }>[] = [];

    lines.forEach(line => {
      if (!line.field_name || !line.table_id) {
        updateRequests.push(of({ success: false, lineId: line.id }));
        return;
      }

      // Find matching column by name (case-insensitive)
      const matchingColumn = columns.find(column => 
        column.name.toLowerCase() === line.field_name!.toLowerCase()
      );

      if (matchingColumn) {
        // Update the line with the matching column and table_id
        updateRequests.push(
          this.apiService.updateLineColumn(line.id, matchingColumn.id, line.table_id).pipe(
            map(() => ({ success: true, lineId: line.id })),
            catchError(error => {
              console.error(`Error updating column for line ${line.id}:`, error);
              return of({ success: false, lineId: line.id });
            })
          )
        );
      } else {
        console.warn(`No matching column found for field_name: ${line.field_name}`);
        updateRequests.push(of({ success: false, lineId: line.id }));
      }
    });

    return forkJoin(updateRequests).pipe(
      map(results => {
        const updated = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        return { updated, failed };
      })
    );
  }
}
