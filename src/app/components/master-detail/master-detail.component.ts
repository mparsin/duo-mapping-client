import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { Subscription } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { CategoryRefreshService } from '../../services/category-refresh.service';
import { Category } from '../../models/category.model';
import { LinesComponent } from '../lines/lines.component';
import {MatTooltip} from '@angular/material/tooltip';

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
    MatExpansionModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
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
  filterText = signal<string>('');
  epicFilterVisible = signal<boolean>(false);
  selectedEpic = signal<string | null>(null);
  private refreshSubscription?: Subscription;

  // Computed property to group categories by tab with filtering
  categoriesByTab = computed(() => {
    const cats = this.categories();
    const filter = this.filterText().toLowerCase().trim();
    const selectedEpicValue = this.selectedEpic();
    
    // Filter categories based on search text and epic filter
    let filteredCats = cats;
    
    // Apply text filter
    if (filter) {
      filteredCats = filteredCats.filter(category => 
        category.Name.toLowerCase().includes(filter) ||
        (category.description && category.description.toLowerCase().includes(filter)) ||
        (category.tab && category.tab.toLowerCase().includes(filter)) ||
        (category.epic && category.epic.toLowerCase().includes(filter))
      );
    }
    
    // Apply epic filter
    if (selectedEpicValue) {
      filteredCats = filteredCats.filter(category => 
        category.epic === selectedEpicValue
      );
    }
    
    const grouped = new Map<string, Category[]>();
    
    filteredCats.forEach(category => {
      const tab = category.tab || 'Uncategorized';
      if (!grouped.has(tab)) {
        grouped.set(tab, []);
      }
      grouped.get(tab)!.push(category);
    });
    
    // If there's a filter, also filter out empty tab groups
    const filteredGroups = filter ? 
      Array.from(grouped.entries()).filter(([tabName, categories]) => 
        categories.length > 0 || tabName.toLowerCase().includes(filter)
      ) : 
      Array.from(grouped.entries());
    
    // Convert to array of objects with tab name and categories
    return filteredGroups.map(([tabName, categories]) => ({
      tabName,
      categories: categories // Keep original order, don't sort
    }));
  });

  // Computed property to get available epics
  availableEpics = computed(() => {
    const cats = this.categories();
    const epics = new Set<string>();
    
    cats.forEach(category => {
      if (category.epic) {
        epics.add(category.epic);
      }
    });
    
    return Array.from(epics).sort();
  });

  // Computed property to get total filtered categories count
  filteredCategoriesCount = computed(() => {
    return this.categoriesByTab().reduce((total, tabGroup) => total + tabGroup.categories.length, 0);
  });

  constructor(
    private apiService: ApiService,
    private categoryRefreshService: CategoryRefreshService,
    private snackBar: MatSnackBar,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  // Ensures the selected category card is scrolled into view (e.g., after refresh or route navigation)
  private scrollSelectedIntoView(): void {
    // Defer until the view updates with the selected state
    setTimeout(() => {
      const el = document.querySelector('.categories-list .category-item.selected') as HTMLElement | null;
      if (el && typeof el.scrollIntoView === 'function') {
        try {
          el.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
        } catch {
          // Fallback for older browsers/environments
          el.scrollIntoView();
        }
      }
    }, 0);
  }

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
    this.scrollSelectedIntoView();
  }

  navigateToHome(): void {
    this.selectedCategory.set(null);
    this.router.navigate(['/'], { replaceUrl: true });
  }

  selectCategoryById(categoryId: number): void {
    const category = this.categories().find(cat => cat.id === categoryId);
    if (category) {
      this.selectedCategory.set(category);
      this.scrollSelectedIntoView();
    } else {
      // If category not found in current list, try to load it individually
      this.apiService.getCategory(categoryId).subscribe({
        next: (category) => {
          this.selectedCategory.set(category);
          this.scrollSelectedIntoView();
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

  // Calculate average progress for a tab
  getTabProgress(categories: Category[]): number {
    if (categories.length === 0) return 0;
    
    const totalProgress = categories.reduce((sum, category) => {
      return sum + (category.percent_mapped || 0);
    }, 0);
    
    return Math.round(totalProgress / categories.length);
  }

  // Check if all categories in a tab are fully mapped
  isTabFullyMapped(categories: Category[]): boolean {
    return categories.every(category => category.percent_mapped === 100);
  }

  // Check if a tab contains the selected category
  tabContainsSelectedCategory(categories: Category[]): boolean {
    const selected = this.selectedCategory();
    return selected ? categories.some(cat => cat.id === selected.id) : false;
  }

  // Get the epic for a tab (returns the first epic found in the categories)
  getTabEpic(categories: Category[]): string | null {
    const categoryWithEpic = categories.find(category => category.epic);
    return categoryWithEpic ? categoryWithEpic.epic! : null;
  }

  // Handle filter input changes
  onFilterChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.filterText.set(target.value);
  }

  // Clear the filter
  clearFilter(): void {
    this.filterText.set('');
  }

  // Toggle epic filter visibility
  toggleEpicFilter(): void {
    this.epicFilterVisible.set(!this.epicFilterVisible());
    if (!this.epicFilterVisible()) {
      this.selectedEpic.set(null);
    }
  }

  // Handle epic selection change
  onEpicChange(epic: string | null): void {
    this.selectedEpic.set(epic);
  }

  // Clear epic filter
  clearEpicFilter(): void {
    this.selectedEpic.set(null);
  }

  // Clear all filters
  clearAllFilters(): void {
    this.filterText.set('');
    this.selectedEpic.set(null);
  }
}

