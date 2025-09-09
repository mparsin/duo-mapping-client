import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SchemaGenerationService } from './services/schema-generation.service';
import { ApiService } from './services/api.service';
import { Category } from './models/category.model';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HttpClientModule, MatToolbarModule, MatButtonModule, MatIconModule, MatSnackBarModule, MatTooltipModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('DUO Mapper');

  constructor(
    private snackBar: MatSnackBar,
    private schemaGenerationService: SchemaGenerationService,
    private apiService: ApiService
  ) {}

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