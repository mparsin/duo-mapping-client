import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatChipsModule } from '@angular/material/chips';
import { Subscription } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { CategoryRefreshService } from '../../services/category-refresh.service';
import { Category } from '../../models/category.model';
import { LinesComponent } from '../lines/lines.component';
import {MatTooltip} from '@angular/material/tooltip-module.d';

@Component({
  selector: 'app-master-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatToolbarModule,
    MatChipsModule,
    LinesComponent,
    MatTooltip
  ],
  templateUrl: './master-detail.component.html',
  styleUrl: './master-detail.component.css'
})
export class MasterDetailComponent implements OnInit, OnDestroy {
  categories = signal<Category[]>([]);
  selectedCategory = signal<Category | null>(null);
  categoriesLoading = signal<boolean>(false);
  categoriesError = signal<string | null>(null);
  private refreshSubscription?: Subscription;

  constructor(
    private apiService: ApiService,
    private categoryRefreshService: CategoryRefreshService,
    private snackBar: MatSnackBar,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCategories();

    // Subscribe to category refresh events
    this.refreshSubscription = this.categoryRefreshService.categoryRefresh$.subscribe(categoryId => {
      this.refreshCategory(categoryId);
    });

    // Subscribe to route parameter changes
    this.route.params.subscribe(params => {
      const categoryId = params['id'];
      if (categoryId) {
        // If there's a category ID in the route, select that category
        this.selectCategoryById(parseInt(categoryId, 10));
      } else {
        // If no category ID in route, clear selection
        this.selectedCategory.set(null);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  loadCategories(): void {
    this.categoriesLoading.set(true);
    this.categoriesError.set(null);

    this.apiService.getCategories().subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.categoriesLoading.set(false);

        // Check if there's a category ID in the route
        const categoryId = this.route.snapshot.params['id'];
        if (categoryId) {
          // Select the category from the route
          this.selectCategoryById(parseInt(categoryId, 10));
        } else if (categories.length > 0) {
          // Auto-select first category if no route parameter
          this.selectCategory(categories[0]);
        }
      },
      error: (error) => {
        console.error('Error loading categories:', error);
        this.categoriesError.set('Failed to load categories. Please try again.');
        this.categoriesLoading.set(false);
        this.snackBar.open('Error loading categories', 'Close', {
          duration: 3000,
          horizontalPosition: 'right',
          verticalPosition: 'top'
        });
      }
    });
  }

  selectCategory(category: Category): void {
    this.selectedCategory.set(category);
    // Navigate to the category-specific URL
    this.router.navigate(['/category', category.id], { replaceUrl: true });
  }

  navigateToHome(): void {
    this.selectedCategory.set(null);
    this.router.navigate(['/'], { replaceUrl: true });
  }

  selectCategoryById(categoryId: number): void {
    const category = this.categories().find(cat => cat.id === categoryId);
    if (category) {
      this.selectedCategory.set(category);
    } else {
      // If category not found in current list, try to load it individually
      this.apiService.getCategory(categoryId).subscribe({
        next: (category) => {
          this.selectedCategory.set(category);
        },
        error: (error) => {
          console.error('Error loading specific category:', error);
          // If category doesn't exist, redirect to home
          this.router.navigate(['/']);
        }
      });
    }
  }

  refreshCategories(): void {
    this.loadCategories();
  }

  refreshCategory(categoryId: number): void {
    console.log('Master-detail: Refreshing category ID:', categoryId);
    this.apiService.getCategory(categoryId).subscribe({
      next: (updatedCategory) => {
        console.log('Master-detail: Received updated category:', updatedCategory);
        const currentCategories = this.categories();
        const index = currentCategories.findIndex(cat => cat.id === categoryId);
        if (index !== -1) {
          const updatedCategories = [...currentCategories];
          updatedCategories[index] = updatedCategory;
          this.categories.set(updatedCategories);

          // Update selected category if it's the one being refreshed
          if (this.selectedCategory()?.id === categoryId) {
            this.selectedCategory.set(updatedCategory);
          }
          console.log('Master-detail: Updated categories signal with new percentage:', updatedCategory.percent_mapped);
        }
      },
      error: (error) => {
        console.error('Error refreshing category:', error);
        // Optionally show a snackbar or handle the error
      }
    });
  }

  // Helper method to round percentage for template
  roundPercentage(percentage: number | undefined): number {
    return percentage ? Math.round(percentage) : 0;
  }
}

