import { Component, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { SchemaGenerationService } from './services/schema-generation.service';
import { ApiService } from './services/api.service';
import { CategoryRefreshService } from './services/category-refresh.service';
import { Category } from './models/category.model';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HttpClientModule, MatToolbarModule, MatButtonModule, MatIconModule, MatSnackBarModule, MatTooltipModule, MatChipsModule, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('DUO Mapper');
  categories = signal<Category[]>([]);
  private refreshSubscription?: Subscription;

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
    private categoryRefreshService: CategoryRefreshService
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

    // Get all categories with their mappings
    this.apiService.getCategories().subscribe({
      next: (categories) => {
        // Generate schema
        this.schemaGenerationService.generateSchema(categories).subscribe({
          next: (schema) => {
            // Validate schema
            const errors = this.schemaGenerationService.validateSchema(schema);
            
            if (errors.length > 0) {
              loadingSnackBar.dismiss();
              this.snackBar.open(`Schema validation failed: ${errors.join(', ')}`, 'Close', {
                duration: 5000,
                horizontalPosition: 'center',
                verticalPosition: 'top',
                panelClass: 'error-snackbar'
              });
              return;
            }

            // Download the schema file
            this.schemaGenerationService.downloadSchema(schema);
            
            loadingSnackBar.dismiss();
            this.snackBar.open('Schema generated and downloaded successfully!', 'Close', {
              duration: 3000,
              horizontalPosition: 'center',
              verticalPosition: 'top',
              panelClass: 'success-snackbar'
            });
          },
          error: (error) => {
            console.error('Error generating schema:', error);
            loadingSnackBar.dismiss();
            this.snackBar.open('Error generating schema. Please try again.', 'Close', {
              duration: 5000,
              horizontalPosition: 'center',
              verticalPosition: 'top',
              panelClass: 'error-snackbar'
            });
          }
        });
      },
      error: (error) => {
        console.error('Error loading categories:', error);
        loadingSnackBar.dismiss();
        this.snackBar.open('Error loading categories. Please try again.', 'Close', {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: 'error-snackbar'
        });
      }
    });
  }
}