import { Component, OnInit, OnDestroy, signal, computed, Signal, Input, OnChanges, SimpleChanges } from '@angular/core';
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
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Observable, map, startWith, forkJoin, of, catchError } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { CategoryRefreshService } from '../../services/category-refresh.service';
import { Line } from '../../models/line.model';
import { Table } from '../../models/table.model';
import { Column } from '../../models/column.model';
import { SubCategory } from '../../models/sub-category.model';
import { TableMatch } from '../../models/table-match.model';
import { TableSuggestionService } from '../../services/table-suggestion.service';
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
    ReactiveFormsModule,
    FormsModule
  ],
  templateUrl: './lines.component.html',
  styleUrl: './lines.component.css'
})
export class LinesComponent implements OnInit, OnDestroy, OnChanges {
  @Input() categoryId: number | null = null;
  @Input() categoryName: string = '';
  @Input() showToolbar: boolean = true;

  lines = signal<Line[]>([]);
  tables = signal<Table[]>([]);
  columns = signal<Column[]>([]);
  subCategories = signal<SubCategory[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  groupBySubCategory = signal<boolean>(true);
  bulkUpdating = signal<boolean>(false);
  bulkUpdatingColumns = signal<boolean>(false);
  bulkClearingTables = signal<boolean>(false);
  bulkClearingColumns = signal<boolean>(false);
  selectedTableId = signal<number | null>(null);
  categoryBulkCommandsVisible = signal<boolean>(false);

  // Main category table suggestion getters (initialized in constructor)
  loadingSuggestedTables!: Signal<boolean>;
  suggestedTables!: Signal<TableMatch[]>;
  showSuggestedTables!: Signal<boolean>;
  bulkUpdateProgress = signal<{ completed: number, total: number, failed: number }>({ completed: 0, total: 0, failed: 0 });
  columnBulkUpdateProgress = signal<{ completed: number, total: number, failed: number }>({ completed: 0, total: 0, failed: 0 });
  tableClearProgress = signal<{ completed: number, total: number, failed: number }>({ completed: 0, total: 0, failed: 0 });
  columnClearProgress = signal<{ completed: number, total: number, failed: number }>({ completed: 0, total: 0, failed: 0 });

  // Form for bulk update
  bulkUpdateForm: FormGroup;

  // Sub-category specific forms and state
  subCategoryBulkUpdateForms = new Map<string, FormGroup>();
  subCategoryBulkUpdating = new Map<string, boolean>();
  subCategoryBulkUpdatingColumns = new Map<string, boolean>();
  subCategoryBulkClearingTables = new Map<string, boolean>();
  subCategoryBulkClearingColumns = new Map<string, boolean>();
  subCategorySelectedTableIds = new Map<string, number | null>();
  subCategoryBulkUpdateProgress = new Map<string, { completed: number, total: number, failed: number }>();
  subCategoryColumnBulkUpdateProgress = new Map<string, { completed: number, total: number, failed: number }>();
  subCategoryTableClearProgress = new Map<string, { completed: number, total: number, failed: number }>();
  subCategoryColumnClearProgress = new Map<string, { completed: number, total: number, failed: number }>();
  subCategoryFilteredTables$ = new Map<string, Observable<Table[]>>();
  subCategoryTableDropdownOpen = new Map<string, boolean>();
  subCategoryBulkCommandsVisible = new Map<string, boolean>();
  private subCategoryUserTypingTable = new Map<string, boolean>();

  // Sub-category comment editing
  subCategoryEditingComment = new Map<string, boolean>();
  subCategoryCommentText = new Map<string, string>();
  subCategorySavingComment = new Map<string, boolean>();


  // Typeahead functionality
  filteredTables$!: Observable<Table[]>;
  tableDropdownOpen = false;
  private userTypingTable = false;

  displayedColumns: string[] = ['id', 'name', 'field_name', 'table_name', 'column_name', 'default', 'reason', 'comment'];

  // Computed properties for bulk update functionality
  linesWithoutTable = computed(() =>
    this.lines().filter(line => !line.table_id && !line.table_name)
  );

  linesWithoutColumn = computed(() =>
    this.lines().filter(line =>
      line.table_id && !line.column_id && line.field_name
    )
  );

  // Computed properties for cleaning operations
  linesWithTable = computed(() =>
    this.lines().filter(line => line.table_id || line.table_name)
  );

  linesWithColumn = computed(() =>
    this.lines().filter(line => line.column_id || line.column_name)
  );

  // Sub-category specific computed properties
  getSubCategoryLinesWithoutTable = (groupName: string): Line[] => {
    const groupLines = this.groupedLines()[groupName] || [];
    return groupLines.filter(line => !line.table_id && !line.table_name);
  };

  getSubCategoryLinesWithoutColumn = (groupName: string): Line[] => {
    const groupLines = this.groupedLines()[groupName] || [];
    return groupLines.filter(line =>
      line.table_id && !line.column_id && line.field_name
    );
  };

  getSubCategoryLinesWithTable = (groupName: string): Line[] => {
    const groupLines = this.groupedLines()[groupName] || [];
    return groupLines.filter(line => line.table_id || line.table_name);
  };

  getSubCategoryLinesWithColumn = (groupName: string): Line[] => {
    const groupLines = this.groupedLines()[groupName] || [];
    return groupLines.filter(line => line.column_id || line.column_name);
  };

  // Computed property for grouping lines by sub-category with sorting info
  groupedLinesWithSorting = computed(() => {
    if (!this.groupBySubCategory()) {
      return { groups: { 'All Lines': this.lines() }, groupOrder: ['All Lines'] };
    }

    console.log('Grouping lines by sub-category...');
    console.log('Lines with sub_category_id:', this.lines().filter(line => line.sub_category_id));
    console.log('Available sub-categories:', this.subCategories());

    const grouped = new Map<string, { lines: Line[], subCategoryId: number | null }>();

    this.lines().forEach(line => {
      const subCategoryId = line.sub_category_id;
      let groupKey = 'Uncategorized';
      let actualSubCategoryId: number | null = null;

      if (subCategoryId) {
        const subCategory = this.subCategories().find(sc => sc.id === subCategoryId);
        groupKey = subCategory ? subCategory.name : `Sub-category ${subCategoryId}`;
        actualSubCategoryId = subCategoryId;
        console.log(`Line ${line.id} (${line.name}) -> Sub-category: ${subCategoryId} -> Group: ${groupKey}`);
      } else {
        console.log(`Line ${line.id} (${line.name}) -> No sub_category_id -> Group: ${groupKey}`);
      }

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, { lines: [], subCategoryId: actualSubCategoryId });
      }
      grouped.get(groupKey)!.lines.push(line);
    });

    // Convert Map to object for easier template iteration
    const groups: { [key: string]: Line[] } = {};
    grouped.forEach((data, key) => {
      groups[key] = data.lines;
    });

    // Sort groups by seq_no to maintain the intended order from the API
    const groupOrder = Array.from(grouped.entries())
      .sort(([, a], [, b]) => {
        // Get the seq_no from the first line in each group
        const aSeqNo = a.lines.length > 0 ? this.getSubCategorySeqNo(a.lines[0].sub_category_id || null) : 999;
        const bSeqNo = b.lines.length > 0 ? this.getSubCategorySeqNo(b.lines[0].sub_category_id || null) : 999;
        
        // If both have the same seq_no, sort by sub-category ID as secondary sort
        if (aSeqNo === bSeqNo) {
          if (a.subCategoryId === null && b.subCategoryId === null) return 0;
          if (a.subCategoryId === null) return 1;
          if (b.subCategoryId === null) return -1;
          return a.subCategoryId - b.subCategoryId;
        }
        
        return aSeqNo - bSeqNo;
      })
      .map(([key]) => key);

    console.log('Final grouped result:', groups);
    console.log('Group order by ID:', groupOrder);
    return { groups, groupOrder };
  });

  // Computed property for grouping lines by sub-category (for backward compatibility)
  groupedLines = computed(() => {
    return this.groupedLinesWithSorting().groups;
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private tableSuggestionService: TableSuggestionService,
    private categoryRefreshService: CategoryRefreshService,
    private fb: FormBuilder
  ) {
    this.bulkUpdateForm = this.fb.group({
      table_name: ['']
    });

    // Initialize table suggestion signals
    this.loadingSuggestedTables = this.tableSuggestionService.getLoadingSignal('main-category');
    this.suggestedTables = this.tableSuggestionService.getSuggestionsSignal('main-category');
    this.showSuggestedTables = this.tableSuggestionService.getVisibleSignal('main-category');
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
      // Clear suggestions when category changes
      this.clearAllTableSuggestions();
      this.loadLines(this.categoryId);
    }
  }

  ngOnDestroy(): void {
    // Clear all suggestions when component is destroyed
    this.clearAllTableSuggestions();
  }

  loadLines(categoryId: number): void {
    this.loading.set(true);
    this.error.set(null);

    // Clear all table suggestions when switching categories
    this.clearAllTableSuggestions();

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
        // console.log('Received lines data:', data.lines);
        // console.log('Received sub-categories data:', data.subCategories);
        // console.log('First line sample:', data.lines[0]);
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

  private setupSubCategoryFilteredObservables(groupName: string): void {
    const form = this.subCategoryBulkUpdateForms.get(groupName);
    if (form) {
      this.subCategoryFilteredTables$.set(
        groupName,
        form.get('table_name')!.valueChanges.pipe(
          startWith(''),
          map(value => {
            if (!this.subCategoryTableDropdownOpen.get(groupName)) {
              return [];
            }
            return this.filterTables(value || '');
          })
        )
      );
    }
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

  // Update lines data without triggering loading state or scroll position loss
  private updateLinesData(): void {
    if (this.categoryId) {
      this.apiService.getLinesByCategory(this.categoryId).subscribe({
        next: (lines) => {
          this.lines.set(lines);
          // Trigger category refresh to update progress
          this.triggerCategoryRefresh();
        },
        error: (error) => {
          console.error('Error updating lines data:', error);
          // Don't show error snackbar for background updates
        }
      });
    }
  }

  // Trigger category refresh to update progress bar
  private triggerCategoryRefresh(): void {
    if (this.categoryId) {
      console.log('Triggering category refresh for category ID:', this.categoryId);
      this.categoryRefreshService.refreshCategory(this.categoryId);
    }
  }


  toggleGroupBySubCategory(): void {
    this.groupBySubCategory.set(!this.groupBySubCategory());
  }

  getGroupKeys(): string[] {
    return this.groupedLinesWithSorting().groupOrder;
  }

  // Sub-category state getters
  getSubCategoryBulkUpdateForm(groupName: string): FormGroup {
    if (!this.subCategoryBulkUpdateForms.has(groupName)) {
      this.subCategoryBulkUpdateForms.set(groupName, this.fb.group({
        table_name: ['']
      }));
      this.setupSubCategoryFilteredObservables(groupName);
    }
    return this.subCategoryBulkUpdateForms.get(groupName)!;
  }

  getSubCategoryBulkUpdating(groupName: string): boolean {
    return this.subCategoryBulkUpdating.get(groupName) || false;
  }

  getSubCategoryBulkUpdatingColumns(groupName: string): boolean {
    return this.subCategoryBulkUpdatingColumns.get(groupName) || false;
  }

  getSubCategoryBulkClearingTables(groupName: string): boolean {
    return this.subCategoryBulkClearingTables.get(groupName) || false;
  }

  getSubCategoryBulkClearingColumns(groupName: string): boolean {
    return this.subCategoryBulkClearingColumns.get(groupName) || false;
  }

  getSubCategorySelectedTableId(groupName: string): number | null {
    return this.subCategorySelectedTableIds.get(groupName) || null;
  }

  getSubCategoryBulkUpdateProgress(groupName: string): { completed: number, total: number, failed: number } {
    return this.subCategoryBulkUpdateProgress.get(groupName) || { completed: 0, total: 0, failed: 0 };
  }

  getSubCategoryColumnBulkUpdateProgress(groupName: string): { completed: number, total: number, failed: number } {
    return this.subCategoryColumnBulkUpdateProgress.get(groupName) || { completed: 0, total: 0, failed: 0 };
  }

  getSubCategoryTableClearProgress(groupName: string): { completed: number, total: number, failed: number } {
    return this.subCategoryTableClearProgress.get(groupName) || { completed: 0, total: 0, failed: 0 };
  }

  getSubCategoryColumnClearProgress(groupName: string): { completed: number, total: number, failed: number } {
    return this.subCategoryColumnClearProgress.get(groupName) || { completed: 0, total: 0, failed: 0 };
  }

  getSubCategoryFilteredTables$(groupName: string): Observable<Table[]> {
    return this.subCategoryFilteredTables$.get(groupName) || of([]);
  }

  getSubCategoryTableDropdownOpen(groupName: string): boolean {
    return this.subCategoryTableDropdownOpen.get(groupName) || false;
  }

  getSubCategoryBulkCommandsVisible(groupName: string): boolean {
    return this.subCategoryBulkCommandsVisible.get(groupName) || false;
  }

  // Sub-category table suggestion getters
  getSubCategoryLoadingSuggestedTables(groupName: string): boolean {
    return this.tableSuggestionService.getLoadingSignal(`subcategory-${groupName}`)();
  }

  getSubCategorySuggestedTables(groupName: string): TableMatch[] {
    return this.tableSuggestionService.getSuggestionsSignal(`subcategory-${groupName}`)();
  }

  getSubCategoryShowSuggestedTables(groupName: string): boolean {
    return this.tableSuggestionService.getVisibleSignal(`subcategory-${groupName}`)();
  }

  toggleSubCategoryBulkCommands(groupName: string): void {
    const currentVisibility = this.subCategoryBulkCommandsVisible.get(groupName) || false;
    this.subCategoryBulkCommandsVisible.set(groupName, !currentVisibility);
  }

  hasSubCategoryBulkCommands(groupName: string): boolean {
    return this.getSubCategoryLinesWithoutTable(groupName).length > 0 ||
           this.getSubCategoryLinesWithoutColumn(groupName).length > 0 ||
           this.getSubCategoryLinesWithTable(groupName).length > 0 ||
           this.getSubCategoryLinesWithColumn(groupName).length > 0;
  }

  // Category bulk commands toggle
  toggleCategoryBulkCommands(): void {
    this.categoryBulkCommandsVisible.set(!this.categoryBulkCommandsVisible());
  }

  hasCategoryBulkCommands(): boolean {
    return this.linesWithoutTable().length > 0 ||
           this.linesWithoutColumn().length > 0 ||
           this.linesWithTable().length > 0 ||
           this.linesWithColumn().length > 0;
  }

  // Computed property to check if all lines have complete mappings
  allLinesHaveCompleteMappings = computed(() => {
    const lines = this.lines();
    if (lines.length === 0) return true;

    return lines.every(line =>
      (line.table_id || line.table_name) &&
      (line.column_id || line.column_name)
    );
  });

  // Computed property to check if all lines in a sub-category have complete mappings
  getSubCategoryAllLinesHaveCompleteMappings = (groupName: string): boolean => {
    const groupLines = this.groupedLines()[groupName] || [];
    if (groupLines.length === 0) return true;

    return groupLines.every(line =>
      (line.table_id || line.table_name) &&
      (line.column_id || line.column_name)
    );
  };


  getStatusColor(status: string | undefined): string {
    switch (status) {
      case 'active': return 'primary';
      case 'inactive': return 'warn';
      case 'pending': return 'accent';
      default: return '';
    }
  }

  // Method to determine if a line needs highlighting
  needsHighlighting(line: Line): boolean {
    return !line.table_id && !line.table_name;
  }

  // Method to determine if a line needs column highlighting
  needsColumnHighlighting(line: Line): boolean {
    return !!(line.table_id || line.table_name) && !line.column_id && !line.column_name && !!line.field_name;
  }

  // Method to determine if a line has a comment
  hasComment(line: Line): boolean {
    return !!(line.comment && line.comment.trim());
  }

  // Method to get CSS classes for highlighting
  getRowClasses(line: Line): string {
    const baseClasses = 'clickable-row';
    if (this.needsHighlighting(line)) {
      // console.log(`Line ${line.id} needs table highlighting:`, line);
      return `${baseClasses} highlight-missing-table test-highlight`;
    } else if (this.needsColumnHighlighting(line)) {
      // console.log(`Line ${line.id} needs column highlighting:`, line);
      return `${baseClasses} highlight-missing-column test-highlight`;
    } else if (this.hasComment(line)) {
      // console.log(`Line ${line.id} has comment:`, line);
      return `${baseClasses} highlight-has-comment`;
    }
    return baseClasses;
  }

  openEditDialog(line: Line): void {
    const dialogRef = this.dialog.open(EditLineDialogComponent, {
      width: '500px',
      data: { 
        line: line,
        categoryId: this.categoryId
      }
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

        // Trigger category refresh to update progress
        this.triggerCategoryRefresh();

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

  // Sub-category event handlers
  onSubCategoryTableInputFocus(groupName: string): void {
    if (this.subCategoryUserTypingTable.get(groupName)) {
      this.subCategoryTableDropdownOpen.set(groupName, true);
      this.getSubCategoryBulkUpdateForm(groupName).get('table_name')?.updateValueAndValidity();
    }
  }

  onSubCategoryTableInputBlur(groupName: string): void {
    setTimeout(() => {
      this.subCategoryTableDropdownOpen.set(groupName, false);
    }, 150);
  }

  onSubCategoryTableInputChange(groupName: string): void {
    this.subCategoryUserTypingTable.set(groupName, true);
    this.subCategoryTableDropdownOpen.set(groupName, true);
    this.getSubCategoryBulkUpdateForm(groupName).get('table_name')?.updateValueAndValidity();
  }

  onSubCategoryTableSelected(groupName: string, table: Table): void {
    this.getSubCategoryBulkUpdateForm(groupName).patchValue({ table_name: table });
    this.subCategorySelectedTableIds.set(groupName, table.id);
    this.subCategoryUserTypingTable.set(groupName, false);
    this.subCategoryTableDropdownOpen.set(groupName, false);
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

        // Clear the form and update the lines data
        this.bulkUpdateForm.patchValue({ table_name: '' });
        this.selectedTableId.set(null);
        this.updateLinesData();
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

            // Update the lines data to show updated columns
            this.updateLinesData();
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

  // Bulk clear table names for all lines
  bulkClearTableNames(): void {
    const linesToClear = this.linesWithTable();

    if (linesToClear.length === 0) {
      this.snackBar.open('No lines with table assignments found to clear', 'Close', {
        duration: 3000,
        horizontalPosition: 'right',
        verticalPosition: 'top'
      });
      return;
    }

    this.bulkClearingTables.set(true);
    this.tableClearProgress.set({ completed: 0, total: linesToClear.length, failed: 0 });

    // Clear table names individually
    this.clearTableNamesIndividually(linesToClear);
  }

  private clearTableNamesIndividually(linesToClear: Line[]): void {
    const clearRequests = linesToClear.map(line =>
      this.apiService.clearLineTable(line.id).pipe(
        catchError(error => {
          console.error(`Error clearing table for line ${line.id}:`, error);
          return of({ error: true, lineId: line.id });
        })
      )
    );

    forkJoin(clearRequests).subscribe({
      next: (results) => {
        this.bulkClearingTables.set(false);

        const successful = results.filter(result => !result.error);
        const failed = results.filter(result => result.error);

        this.tableClearProgress.set({
          completed: successful.length,
          total: linesToClear.length,
          failed: failed.length
        });

        if (successful.length > 0) {
          this.snackBar.open(
            `Successfully cleared table names for ${successful.length} line(s)${failed.length > 0 ? `, ${failed.length} failed` : ''}`,
            'Close',
            {
              duration: 5000,
              horizontalPosition: 'right',
              verticalPosition: 'top'
            }
          );
        } else {
          this.snackBar.open('Failed to clear table names for any lines', 'Close', {
            duration: 3000,
            horizontalPosition: 'right',
            verticalPosition: 'top'
          });
        }

        this.updateLinesData();
      },
      error: (error) => {
        console.error('Error in bulk table clear:', error);
        this.bulkClearingTables.set(false);
        this.snackBar.open('Error clearing table names. Please try again.', 'Close', {
          duration: 3000,
          horizontalPosition: 'right',
          verticalPosition: 'top'
        });
      }
    });
  }

  // Bulk clear column names for all lines
  bulkClearColumnNames(): void {
    const linesToClear = this.linesWithColumn();

    if (linesToClear.length === 0) {
      this.snackBar.open('No lines with column assignments found to clear', 'Close', {
        duration: 3000,
        horizontalPosition: 'right',
        verticalPosition: 'top'
      });
      return;
    }

    this.bulkClearingColumns.set(true);
    this.columnClearProgress.set({ completed: 0, total: linesToClear.length, failed: 0 });

    // Clear column names individually
    this.clearColumnNamesIndividually(linesToClear);
  }

  private clearColumnNamesIndividually(linesToClear: Line[]): void {
    const clearRequests = linesToClear.map(line =>
      this.apiService.clearLineColumn(line.id).pipe(
        catchError(error => {
          console.error(`Error clearing column for line ${line.id}:`, error);
          return of({ error: true, lineId: line.id });
        })
      )
    );

    forkJoin(clearRequests).subscribe({
      next: (results) => {
        this.bulkClearingColumns.set(false);

        const successful = results.filter(result => !result.error);
        const failed = results.filter(result => result.error);

        this.columnClearProgress.set({
          completed: successful.length,
          total: linesToClear.length,
          failed: failed.length
        });

        if (successful.length > 0) {
          this.snackBar.open(
            `Successfully cleared column names for ${successful.length} line(s)${failed.length > 0 ? `, ${failed.length} failed` : ''}`,
            'Close',
            {
              duration: 5000,
              horizontalPosition: 'right',
              verticalPosition: 'top'
            }
          );
        } else {
          this.snackBar.open('Failed to clear column names for any lines', 'Close', {
            duration: 3000,
            horizontalPosition: 'right',
            verticalPosition: 'top'
          });
        }

        this.updateLinesData();
      },
      error: (error) => {
        console.error('Error in bulk column clear:', error);
        this.bulkClearingColumns.set(false);
        this.snackBar.open('Error clearing column names. Please try again.', 'Close', {
          duration: 3000,
          horizontalPosition: 'right',
          verticalPosition: 'top'
        });
      }
    });
  }

  // Sub-category bulk update methods
  bulkUpdateTableForSubCategory(groupName: string): void {
    const categoryId = this.categoryId;
    const formValue = this.getSubCategoryBulkUpdateForm(groupName).value;

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

    const linesToUpdate = this.getSubCategoryLinesWithoutTable(groupName);
    if (linesToUpdate.length === 0) {
      this.snackBar.open('No lines without table found to update in this sub-category', 'Close', {
        duration: 3000,
        horizontalPosition: 'right',
        verticalPosition: 'top'
      });
      return;
    }

    this.subCategoryBulkUpdating.set(groupName, true);
    this.subCategoryBulkUpdateProgress.set(groupName, { completed: 0, total: linesToUpdate.length, failed: 0 });

    // Update lines individually with only table_id
    this.updateSubCategoryLinesIndividually(groupName, linesToUpdate, tableId);
  }

  private updateSubCategoryLinesIndividually(groupName: string, linesToUpdate: Line[], tableId: number): void {
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
        this.subCategoryBulkUpdating.set(groupName, false);

        const successful = results.filter(result => !result.error);
        const failed = results.filter(result => result.error);

        this.subCategoryBulkUpdateProgress.set(groupName, {
          completed: successful.length,
          total: linesToUpdate.length,
          failed: failed.length
        });

        // Show success message
        if (successful.length > 0) {
          this.snackBar.open(
            `Successfully updated ${successful.length} line(s) in ${groupName}${failed.length > 0 ? `, ${failed.length} failed` : ''}`,
            'Close',
            {
              duration: 5000,
              horizontalPosition: 'right',
              verticalPosition: 'top'
            }
          );
        } else {
          this.snackBar.open(`Failed to update any lines in ${groupName}`, 'Close', {
            duration: 3000,
            horizontalPosition: 'right',
            verticalPosition: 'top'
          });
        }

        // Clear the form and update the lines data
        this.getSubCategoryBulkUpdateForm(groupName).patchValue({ table_name: '' });
        this.subCategorySelectedTableIds.set(groupName, null);
        this.updateLinesData();
      },
      error: (error) => {
        console.error('Error in sub-category bulk update:', error);
        this.subCategoryBulkUpdating.set(groupName, false);
        this.snackBar.open(`Error updating lines in ${groupName}. Please try again.`, 'Close', {
          duration: 3000,
          horizontalPosition: 'right',
          verticalPosition: 'top'
        });
      }
    });
  }

  bulkUpdateColumnsForSubCategory(groupName: string): void {
    const linesToUpdate = this.getSubCategoryLinesWithoutColumn(groupName);

    if (linesToUpdate.length === 0) {
      this.snackBar.open(`No lines found in ${groupName} that need column updates`, 'Close', {
        duration: 3000,
        horizontalPosition: 'right',
        verticalPosition: 'top'
      });
      return;
    }

    this.subCategoryBulkUpdatingColumns.set(groupName, true);
    this.subCategoryColumnBulkUpdateProgress.set(groupName, { completed: 0, total: linesToUpdate.length, failed: 0 });

    // Group lines by table_id to load columns for each table
    const linesByTable = this.groupLinesByTable(linesToUpdate);
    this.updateSubCategoryColumnsForTables(groupName, linesByTable);
  }

  private updateSubCategoryColumnsForTables(groupName: string, linesByTable: Map<number, Line[]>): void {
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

            this.subCategoryBulkUpdatingColumns.set(groupName, false);
            this.subCategoryColumnBulkUpdateProgress.set(groupName, {
              completed: totalUpdated,
              total: linesByTable.size > 0 ? Array.from(linesByTable.values()).flat().length : 0,
              failed: totalFailed
            });

            this.snackBar.open(
              `Successfully updated ${totalUpdated} column(s) in ${groupName}${totalFailed > 0 ? `, ${totalFailed} failed` : ''}`,
              'Close',
              {
                duration: 5000,
                horizontalPosition: 'right',
                verticalPosition: 'top'
              }
            );

            // Update the lines data to show updated columns
            this.updateLinesData();
          },
          error: (error) => {
            console.error('Error in sub-category column updates:', error);
            this.subCategoryBulkUpdatingColumns.set(groupName, false);
            this.snackBar.open(`Error updating columns in ${groupName}. Please try again.`, 'Close', {
              duration: 3000,
              horizontalPosition: 'right',
              verticalPosition: 'top'
            });
          }
        });
      },
      error: (error) => {
        console.error('Error in sub-category column bulk update:', error);
        this.subCategoryBulkUpdatingColumns.set(groupName, false);
        this.snackBar.open(`Error loading columns for ${groupName}. Please try again.`, 'Close', {
          duration: 3000,
          horizontalPosition: 'right',
          verticalPosition: 'top'
        });
      }
    });
  }

  // Sub-category bulk clear table names
  bulkClearTableNamesForSubCategory(groupName: string): void {
    const linesToClear = this.getSubCategoryLinesWithTable(groupName);

    if (linesToClear.length === 0) {
      this.snackBar.open(`No lines with table assignments found to clear in ${groupName}`, 'Close', {
        duration: 3000,
        horizontalPosition: 'right',
        verticalPosition: 'top'
      });
      return;
    }

    this.subCategoryBulkClearingTables.set(groupName, true);
    this.subCategoryTableClearProgress.set(groupName, { completed: 0, total: linesToClear.length, failed: 0 });

    // Clear table names individually
    this.clearSubCategoryTableNamesIndividually(groupName, linesToClear);
  }

  private clearSubCategoryTableNamesIndividually(groupName: string, linesToClear: Line[]): void {
    const clearRequests = linesToClear.map(line =>
      this.apiService.clearLineTable(line.id).pipe(
        catchError(error => {
          console.error(`Error clearing table for line ${line.id}:`, error);
          return of({ error: true, lineId: line.id });
        })
      )
    );

    forkJoin(clearRequests).subscribe({
      next: (results) => {
        this.subCategoryBulkClearingTables.set(groupName, false);

        const successful = results.filter(result => !result.error);
        const failed = results.filter(result => result.error);

        this.subCategoryTableClearProgress.set(groupName, {
          completed: successful.length,
          total: linesToClear.length,
          failed: failed.length
        });

        if (successful.length > 0) {
          this.snackBar.open(
            `Successfully cleared table names for ${successful.length} line(s) in ${groupName}${failed.length > 0 ? `, ${failed.length} failed` : ''}`,
            'Close',
            {
              duration: 5000,
              horizontalPosition: 'right',
              verticalPosition: 'top'
            }
          );
        } else {
          this.snackBar.open(`Failed to clear table names for any lines in ${groupName}`, 'Close', {
            duration: 3000,
            horizontalPosition: 'right',
            verticalPosition: 'top'
          });
        }

        this.updateLinesData();
      },
      error: (error) => {
        console.error('Error in sub-category bulk table clear:', error);
        this.subCategoryBulkClearingTables.set(groupName, false);
        this.snackBar.open(`Error clearing table names in ${groupName}. Please try again.`, 'Close', {
          duration: 3000,
          horizontalPosition: 'right',
          verticalPosition: 'top'
        });
      }
    });
  }

  // Sub-category bulk clear column names
  bulkClearColumnNamesForSubCategory(groupName: string): void {
    const linesToClear = this.getSubCategoryLinesWithColumn(groupName);

    if (linesToClear.length === 0) {
      this.snackBar.open(`No lines with column assignments found to clear in ${groupName}`, 'Close', {
        duration: 3000,
        horizontalPosition: 'right',
        verticalPosition: 'top'
      });
      return;
    }

    this.subCategoryBulkClearingColumns.set(groupName, true);
    this.subCategoryColumnClearProgress.set(groupName, { completed: 0, total: linesToClear.length, failed: 0 });

    // Clear column names individually
    this.clearSubCategoryColumnNamesIndividually(groupName, linesToClear);
  }

  private clearSubCategoryColumnNamesIndividually(groupName: string, linesToClear: Line[]): void {
    const clearRequests = linesToClear.map(line =>
      this.apiService.clearLineColumn(line.id).pipe(
        catchError(error => {
          console.error(`Error clearing column for line ${line.id}:`, error);
          return of({ error: true, lineId: line.id });
        })
      )
    );

    forkJoin(clearRequests).subscribe({
      next: (results) => {
        this.subCategoryBulkClearingColumns.set(groupName, false);

        const successful = results.filter(result => !result.error);
        const failed = results.filter(result => result.error);

        this.subCategoryColumnClearProgress.set(groupName, {
          completed: successful.length,
          total: linesToClear.length,
          failed: failed.length
        });

        if (successful.length > 0) {
          this.snackBar.open(
            `Successfully cleared column names for ${successful.length} line(s) in ${groupName}${failed.length > 0 ? `, ${failed.length} failed` : ''}`,
            'Close',
            {
              duration: 5000,
              horizontalPosition: 'right',
              verticalPosition: 'top'
            }
          );
        } else {
          this.snackBar.open(`Failed to clear column names for any lines in ${groupName}`, 'Close', {
            duration: 3000,
            horizontalPosition: 'right',
            verticalPosition: 'top'
          });
        }

        this.updateLinesData();
      },
      error: (error) => {
        console.error('Error in sub-category bulk column clear:', error);
        this.subCategoryBulkClearingColumns.set(groupName, false);
        this.snackBar.open(`Error clearing column names in ${groupName}. Please try again.`, 'Close', {
          duration: 3000,
          horizontalPosition: 'right',
          verticalPosition: 'top'
        });
      }
    });
  }

  onSuggestTables(): void {
    const currentLines = this.lines();

    this.tableSuggestionService.suggestTables('main-category', currentLines).subscribe({
      next: (matches) => {
        console.log('Main category suggestions received:', matches);
        console.log('showSuggestedTables signal value:', this.showSuggestedTables());
        console.log('suggestedTables signal value:', this.suggestedTables());

        if (matches.length === 0) {
          this.snackBar.open('No matching tables found', 'Close', {
            duration: 3000,
            horizontalPosition: 'right',
            verticalPosition: 'top'
          });
        } else {
          this.snackBar.open(`Found ${matches.length} matching tables`, 'Close', {
            duration: 2000,
            horizontalPosition: 'right',
            verticalPosition: 'top'
          });
        }
      },
      error: (error) => {
        console.error('Error finding table matches:', error);
        this.snackBar.open('Error finding table matches', 'Close', {
          duration: 3000,
          horizontalPosition: 'right',
          verticalPosition: 'top'
        });
      }
    });
  }

  onSelectSuggestedTable(tableMatch: TableMatch): void {
    const table = this.tableSuggestionService.selectTable('main-category', tableMatch, this.tables());
    if (table) {
      // Set the table in the form
      this.bulkUpdateForm.patchValue({ table_name: table });
      this.selectedTableId.set(table.id);

      // Reset typing flag after selection
      this.userTypingTable = false;
      this.tableDropdownOpen = false;

      this.snackBar.open(`Selected table: ${tableMatch.table_name}`, 'Close', {
        duration: 2000,
        horizontalPosition: 'right',
        verticalPosition: 'top'
      });
    } else {
      this.snackBar.open(`Table ${tableMatch.table_name} not found in loaded tables`, 'Close', {
        duration: 3000,
        horizontalPosition: 'right',
        verticalPosition: 'top'
      });
    }
  }

  closeSuggestedTables(): void {
    this.tableSuggestionService.closeSuggestions('main-category');
  }

  clearAllTableSuggestions(): void {
    // Clear main category suggestions
    this.tableSuggestionService.closeSuggestions('main-category');

    // Clear all sub-category suggestions
    const groupKeys = this.getGroupKeys();
    groupKeys.forEach(groupName => {
      this.tableSuggestionService.closeSuggestions(`subcategory-${groupName}`);
    });
  }

  // Sub-category table suggestion methods
  onSuggestTablesForSubCategory(groupName: string): void {
    const groupLines = this.getSubCategoryLines(groupName);

    this.tableSuggestionService.suggestTables(`subcategory-${groupName}`, groupLines).subscribe({
      next: (matches) => {
        if (matches.length === 0) {
          this.snackBar.open('No matching tables found', 'Close', {
            duration: 3000,
            horizontalPosition: 'right',
            verticalPosition: 'top'
          });
        } else {
          this.snackBar.open(`Found ${matches.length} matching tables for ${groupName}`, 'Close', {
            duration: 2000,
            horizontalPosition: 'right',
            verticalPosition: 'top'
          });
        }
      },
      error: (error) => {
        console.error('Error finding table matches for sub-category:', error);
        this.snackBar.open('Error finding table matches', 'Close', {
          duration: 3000,
          horizontalPosition: 'right',
          verticalPosition: 'top'
        });
      }
    });
  }

  onSelectSuggestedTableForSubCategory(groupName: string, tableMatch: TableMatch): void {
    const table = this.tableSuggestionService.selectTable(`subcategory-${groupName}`, tableMatch, this.tables());
    if (table) {
      // Set the table in the sub-category form
      const form = this.getSubCategoryBulkUpdateForm(groupName);
      form.patchValue({ table_name: table });
      this.subCategorySelectedTableIds.set(groupName, table.id);

      // Reset typing flag after selection
      this.subCategoryUserTypingTable.set(groupName, false);
      this.subCategoryTableDropdownOpen.set(groupName, false);

      this.snackBar.open(`Selected table: ${tableMatch.table_name} for ${groupName}`, 'Close', {
        duration: 2000,
        horizontalPosition: 'right',
        verticalPosition: 'top'
      });
    } else {
      this.snackBar.open(`Table ${tableMatch.table_name} not found in loaded tables`, 'Close', {
        duration: 3000,
        horizontalPosition: 'right',
        verticalPosition: 'top'
      });
    }
  }

  closeSuggestedTablesForSubCategory(groupName: string): void {
    this.tableSuggestionService.closeSuggestions(`subcategory-${groupName}`);
  }

  private getSubCategoryLines(groupName: string): Line[] {
    const grouped = this.groupedLinesWithSorting();
    return grouped.groups[groupName] || [];
  }

  // Sub-category comment editing methods
  getSubCategoryComment(groupName: string): string {
    const subCategory = this.getSubCategoryByName(groupName);
    return subCategory?.comment || '';
  }

  getSubCategoryEditingComment(groupName: string): boolean {
    return this.subCategoryEditingComment.get(groupName) || false;
  }

  getSubCategoryCommentText(groupName: string): string {
    return this.subCategoryCommentText.get(groupName) || '';
  }

  getSubCategorySavingComment(groupName: string): boolean {
    return this.subCategorySavingComment.get(groupName) || false;
  }

  startEditingSubCategoryComment(groupName: string): void {
    const subCategory = this.getSubCategoryByName(groupName);
    if (subCategory) {
      this.subCategoryEditingComment.set(groupName, true);
      this.subCategoryCommentText.set(groupName, subCategory.comment || '');
    }
  }

  cancelEditingSubCategoryComment(groupName: string): void {
    this.subCategoryEditingComment.set(groupName, false);
    this.subCategoryCommentText.set(groupName, '');
  }

  saveSubCategoryComment(groupName: string): void {
    const categoryId = this.categoryId;
    const subCategory = this.getSubCategoryByName(groupName);
    
    if (!categoryId || !subCategory) {
      return;
    }

    const commentText = this.subCategoryCommentText.get(groupName) || '';
    this.subCategorySavingComment.set(groupName, true);

    this.apiService.updateSubCategory(categoryId, subCategory.id, commentText).subscribe({
      next: (updatedSubCategory) => {
        // Update the sub-category in the local state
        const currentSubCategories = this.subCategories();
        const index = currentSubCategories.findIndex(sc => sc.id === subCategory.id);
        if (index !== -1) {
          const updatedSubCategories = [...currentSubCategories];
          updatedSubCategories[index] = updatedSubCategory;
          this.subCategories.set(updatedSubCategories);
        }

        this.subCategoryEditingComment.set(groupName, false);
        this.subCategoryCommentText.set(groupName, '');
        this.subCategorySavingComment.set(groupName, false);

        this.snackBar.open('Comment saved successfully', 'Close', {
          duration: 2000,
          horizontalPosition: 'right',
          verticalPosition: 'top'
        });
      },
      error: (error) => {
        console.error('Error saving sub-category comment:', error);
        this.subCategorySavingComment.set(groupName, false);
        this.snackBar.open('Error saving comment', 'Close', {
          duration: 3000,
          horizontalPosition: 'right',
          verticalPosition: 'top'
        });
      }
    });
  }

  private getSubCategoryByName(groupName: string): SubCategory | undefined {
    if (groupName === 'Uncategorized') {
      return undefined;
    }
    
    const subCategoryId = this.getSubCategoryIdFromGroupName(groupName);
    if (subCategoryId) {
      return this.subCategories().find(sc => sc.id === subCategoryId);
    }
    
    return undefined;
  }

  private getSubCategoryIdFromGroupName(groupName: string): number | null {
    const grouped = this.groupedLinesWithSorting();
    const groupData = grouped.groups[groupName];
    if (groupData && groupData.length > 0) {
      return groupData[0].sub_category_id || null;
    }
    return null;
  }

  private getSubCategorySeqNo(subCategoryId: number | null): number {
    if (!subCategoryId) return 999; // Uncategorized items go last
    
    const subCategory = this.subCategories().find(sc => sc.id === subCategoryId);
    return subCategory?.seq_no || 999;
  }
}
