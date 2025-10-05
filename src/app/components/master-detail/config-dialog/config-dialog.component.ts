import { Component, Inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import * as Prism from 'prismjs';
import 'prismjs/components/prism-json';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-config-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    FormsModule
  ],
  templateUrl: './config-dialog.component.html',
  styleUrl: './config-dialog.component.css'
})
export class ConfigDialogComponent implements OnInit {
  // Signals for reactive state management
  isEditing = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  hasError = signal<boolean>(false);
  errorMessage = signal<string>('');
  
  // Form data
  configText = '';
  originalConfigText = '';

  constructor(
    public dialogRef: MatDialogRef<ConfigDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { categoryId: number, categoryName: string, config: any },
    private apiService: ApiService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    // Initialize config text
    this.configText = this.data.config ? JSON.stringify(this.data.config, null, 2) : '{}';
    this.originalConfigText = this.configText;
    
    // Ensure Prism is loaded and JSON language is available
    if (typeof Prism !== 'undefined' && Prism.languages && Prism.languages['json']) {
      console.log('Prism.js and JSON language loaded successfully');
    } else {
      console.error('Prism.js or JSON language not loaded properly');
    }
  }

  get hasConfig(): boolean {
    return !!this.data.config;
  }

  get hasChanges(): boolean {
    return this.configText !== this.originalConfigText;
  }

  get isValidJson(): boolean {
    try {
      JSON.parse(this.configText);
      return true;
    } catch {
      return false;
    }
  }

  get highlightedConfig(): string {
    if (!this.isValidJson) return this.configText;
    
    // Check if Prism and JSON language are available
    if (typeof Prism === 'undefined' || !Prism.languages || !Prism.languages['json']) {
      return this.configText;
    }
    
    try {
      return Prism.highlight(this.configText, Prism.languages['json'], 'json');
    } catch (error) {
      console.error('Error highlighting JSON:', error);
      return this.configText;
    }
  }

  startEditing(): void {
    this.isEditing.set(true);
    this.hasError.set(false);
    this.errorMessage.set('');
  }

  cancelEditing(): void {
    this.configText = this.originalConfigText;
    this.isEditing.set(false);
    this.hasError.set(false);
    this.errorMessage.set('');
  }

  saveConfig(): void {
    if (!this.isValidJson) {
      this.hasError.set(true);
      this.errorMessage.set('Invalid JSON format. Please check your syntax.');
      return;
    }

    this.isLoading.set(true);
    this.hasError.set(false);
    this.errorMessage.set('');

    try {
      const configObject = JSON.parse(this.configText);
      
      const operation = this.hasConfig 
        ? this.apiService.updateCategoryConfig(this.data.categoryId, configObject)
        : this.apiService.createCategoryConfig(this.data.categoryId, configObject);

      operation.subscribe({
        next: (updatedCategory) => {
          this.isLoading.set(false);
          this.originalConfigText = this.configText;
          this.isEditing.set(false);
          this.snackBar.open('Configuration saved successfully!', 'Close', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
          // Close dialog and return the updated category
          this.dialogRef.close(updatedCategory);
        },
        error: (error) => {
          this.isLoading.set(false);
          this.hasError.set(true);
          this.errorMessage.set('Failed to save configuration. Please try again.');
          console.error('Error saving config:', error);
        }
      });
    } catch (error) {
      this.isLoading.set(false);
      this.hasError.set(true);
      this.errorMessage.set('Invalid JSON format. Please check your syntax.');
    }
  }

  deleteConfig(): void {
    if (!this.hasConfig) return;

    this.isLoading.set(true);
    this.hasError.set(false);
    this.errorMessage.set('');

    this.apiService.deleteCategoryConfig(this.data.categoryId).subscribe({
      next: (updatedCategory) => {
        this.isLoading.set(false);
        this.snackBar.open('Configuration deleted successfully!', 'Close', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
        // Close dialog and return the updated category
        this.dialogRef.close(updatedCategory);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.hasError.set(true);
        this.errorMessage.set('Failed to delete configuration. Please try again.');
        console.error('Error deleting config:', error);
      }
    });
  }

  onClose(): void {
    this.dialogRef.close();
  }
}
