import { Component, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatMenuModule } from '@angular/material/menu';
import { CommonModule } from '@angular/common';
import { Subscription} from 'rxjs';
import { SchemaGenerationService } from './services/schema-generation.service';
import { ApiService } from './services/api.service';
import { CategoryRefreshService } from './services/category-refresh.service';
import { Category } from './models/category.model';
import { SearchResult } from './models/search-result.model';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HttpClientModule, MatToolbarModule, MatButtonModule, MatIconModule, MatSnackBarModule, MatTooltipModule, MatChipsModule, MatInputModule, MatFormFieldModule, MatAutocompleteModule, MatMenuModule, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('DUO Mapper');
  categories = signal<Category[]>([]);
  private refreshSubscription?: Subscription;

  // Search functionality
  searchQuery = signal<string>('');
  searchResults = signal<SearchResult[]>([]);
  searchLoading = signal<boolean>(false);
  searchError = signal<string | null>(null);
  showSearchResults = signal<boolean>(false);
  private searchSubscription?: Subscription;

  // Computed property to calculate overall progress
  overallProgress = computed(() => {
    const cats = this.categories();
    if (cats.length === 0) return 0;

    const totalProgress = cats.reduce((sum, category) => {
      return sum + (category.percent_mapped || 0);
    }, 0);

    return Math.round(totalProgress / cats.length);
  });

  constructor(
    private snackBar: MatSnackBar,
    private schemaGenerationService: SchemaGenerationService,
    private apiService: ApiService,
    private categoryRefreshService: CategoryRefreshService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCategories();

    // Subscribe to category refresh events
    this.refreshSubscription = this.categoryRefreshService.categoryRefresh$.subscribe(categoryId => {
      this.refreshCategory(categoryId);
    });
  }

  ngOnDestroy(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
  }

  loadCategories(): void {
    this.apiService.getCategories().subscribe({
      next: (categories) => {
        this.categories.set(categories);
      },
      error: (error) => {
        console.error('Error loading categories for overall progress:', error);
      }
    });
  }

  refreshCategory(categoryId: number): void {
    this.apiService.getCategory(categoryId).subscribe({
      next: (updatedCategory) => {
        const currentCategories = this.categories();
        const index = currentCategories.findIndex(cat => cat.id === categoryId);
        if (index !== -1) {
          const updatedCategories = [...currentCategories];
          updatedCategories[index] = updatedCategory;
          this.categories.set(updatedCategories);
        }
      },
      error: (error) => {
        console.error('Error refreshing category for overall progress:', error);
      }
    });
  }

  generateSchema(): void {
    // Show loading message
    const loadingSnackBar = this.snackBar.open('Generating schema...', '', {
      duration: 0, // Keep open until dismissed
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: 'schema-generation-snackbar'
    });

    // Download schema from API
    this.schemaGenerationService.downloadSchemaFromApi().subscribe({
      next: (blob) => {
        // Download the schema file
        this.schemaGenerationService.downloadSchemaFromBlob(blob, 'schema-config.json');

        loadingSnackBar.dismiss();
        this.snackBar.open('Schema generated and downloaded successfully!', 'Close', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: 'success-snackbar'
        });
      },
      error: (error) => {
        console.error('Error downloading schema:', error);
        loadingSnackBar.dismiss();
        this.snackBar.open('Error downloading schema. Please try again.', 'Close', {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: 'error-snackbar'
        });
      }
    });
  }

  generateUploadConfig(): void {
    // Show loading message
    const loadingSnackBar = this.snackBar.open('Generating upload config...', '', {
      duration: 0, // Keep open until dismissed
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: 'upload-config-generation-snackbar'
    });

    // Download upload config from API
    this.apiService.downloadUploadConfig().subscribe({
      next: (blob) => {
        // Download the upload config file
        this.schemaGenerationService.downloadSchemaFromBlob(blob, 'upload-config.json');

        loadingSnackBar.dismiss();
        this.snackBar.open('Upload config generated and downloaded successfully!', 'Close', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: 'success-snackbar'
        });
      },
      error: (error) => {
        console.error('Error downloading upload config:', error);
        loadingSnackBar.dismiss();
        this.snackBar.open('Error downloading upload config. Please try again.', 'Close', {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: 'error-snackbar'
        });
      }
    });
  }

  navigateToUploadConfigEditor(): void {
    this.router.navigate(['/upload-config-editor']);
    this.showSearchResults.set(false);
  }

  // Search methods
  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const query = target.value.trim();
    this.searchQuery.set(query);

    if (query.length >= 2) {
      this.performSearch(query);
    } else {
      this.searchResults.set([]);
      this.showSearchResults.set(false);
    }
  }

  private performSearch(query: string): void {
    this.searchLoading.set(true);
    this.searchError.set(null);

    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }

    this.searchSubscription = this.apiService.searchColumns(query).subscribe({
      next: (results) => {
        this.searchResults.set(results);
        this.showSearchResults.set(true);
        this.searchLoading.set(false);
      },
      error: (error) => {
        console.error('Error searching columns:', error);
        this.searchError.set('Failed to search columns');
        this.searchResults.set([]);
        this.showSearchResults.set(false);
        this.searchLoading.set(false);
      }
    });
  }

  onSearchFocus(): void {
    if (this.searchResults().length > 0) {
      this.showSearchResults.set(true);
    }
  }

  onSearchBlur(): void {
    // Delay hiding to allow clicking on results
    setTimeout(() => {
      this.showSearchResults.set(false);
    }, 200);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.showSearchResults.set(false);
    this.searchError.set(null);
  }

  onSearchResultClick(event: Event): void {
    // Prevent the mousedown from causing the input to lose focus
    event.preventDefault();
    event.stopPropagation();
  }

  navigateToCategory(categoryId: number): void {
    this.router.navigate(['/category', categoryId]);
    this.showSearchResults.set(false);
  }

  onSearchResultItemClick(result: SearchResult): void {
    // If the result has mapped categories, navigate to the first one
    if (result.mapped_categories && result.mapped_categories.length > 0) {
      this.navigateToCategory(result.mapped_categories[0].id);
    } else {
      // If no mapped categories, show a message
      this.snackBar.open(`Column "${result.column_name}" is not mapped to any category yet`, 'Close', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      this.showSearchResults.set(false);
    }
  }

  getSearchResultDisplayText(result: SearchResult): string {
    return `${result.column_name} (${result.table_name})`;
  }
}
