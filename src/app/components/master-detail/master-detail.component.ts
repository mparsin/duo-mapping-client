import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatChipsModule } from '@angular/material/chips';
import { ApiService } from '../../services/api.service';
import { Category } from '../../models/category.model';
import { LinesComponent } from '../lines/lines.component';

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
    LinesComponent
  ],
  templateUrl: './master-detail.component.html',
  styleUrl: './master-detail.component.css'
})
export class MasterDetailComponent implements OnInit {
  categories = signal<Category[]>([]);
  selectedCategory = signal<Category | null>(null);
  categoriesLoading = signal<boolean>(false);
  categoriesError = signal<string | null>(null);

  constructor(
    private apiService: ApiService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.categoriesLoading.set(true);
    this.categoriesError.set(null);

    this.apiService.getCategories().subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.categoriesLoading.set(false);
        // Auto-select first category if available
        if (categories.length > 0) {
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
  }

  refreshCategories(): void {
    this.loadCategories();
  }
}

