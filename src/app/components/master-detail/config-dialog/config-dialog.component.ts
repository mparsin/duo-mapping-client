import { Component, Inject, OnInit, signal, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';

declare const monaco: any;

interface MonacoEditor {
  editor: {
    create: (element: HTMLElement, options: any) => any;
  };
  languages: {
    json: {
      jsonDefaults: {
        setDiagnosticsOptions: (options: any) => void;
      };
    };
  };
}

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
export class ConfigDialogComponent implements OnInit, AfterViewInit, OnDestroy {
  // Signals for reactive state management
  isEditing = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  hasError = signal<boolean>(false);
  errorMessage = signal<string>('');
  
  // Form data
  configText = '';
  originalConfigText = '';
  
  // Monaco editor
  @ViewChild('editor', { static: false }) editorElement!: ElementRef;
  private editor: any = null;

  constructor(
    public dialogRef: MatDialogRef<ConfigDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { categoryId: number, categoryName: string, config: any },
    private apiService: ApiService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    // Initialize config text
    if (this.data.config) {
      this.configText = JSON.stringify(this.data.config, null, 2);
    } else {
      // For new configs, start with empty JSON
      this.configText = '{\n  \n}';
    }
    this.originalConfigText = this.configText;
  }

  async ngAfterViewInit(): Promise<void> {
    console.log('ngAfterViewInit called');
    console.log('Editor element:', this.editorElement);
    console.log('Editor element nativeElement:', this.editorElement?.nativeElement);
    
    // Initialize Monaco editor
    try {
      await this.initializeEditor();
      console.log('Editor initialization completed');
    } catch (error) {
      console.error('Editor initialization failed:', error);
    }
  }

  ngOnDestroy(): void {
    // Clean up editor
    if (this.editor) {
      this.editor.dispose();
      this.editor = null;
    }
  }

  private async initializeEditor(): Promise<void> {
    if (!this.editorElement) {
      console.log('Editor element not found');
      return;
    }

    try {
      console.log('Initializing Monaco editor...');
      
      // Load Monaco editor from CDN if not already loaded
      if (typeof monaco === 'undefined') {
        console.log('Loading Monaco from CDN...');
        await this.loadMonacoEditor();
      }

      // Determine if editor should be read-only
      // If there's no existing config, start in edit mode
      const shouldBeReadOnly = this.hasConfig && !this.isEditing();
      console.log('Editor should be read-only:', shouldBeReadOnly);
      console.log('Has config:', this.hasConfig);
      console.log('Is editing:', this.isEditing());
      console.log('Config text:', this.configText);

      this.editor = monaco.editor.create(this.editorElement.nativeElement, {
        value: this.configText,
        language: 'json',
        theme: 'vs',
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 14,
        fontFamily: 'Monaco, Menlo, Ubuntu Mono, monospace',
        lineNumbers: 'on',
        wordWrap: 'on',
        formatOnPaste: true,
        formatOnType: true,
        tabSize: 2,
        insertSpaces: true,
        renderWhitespace: 'selection',
        bracketPairColorization: { enabled: true },
        guides: {
          bracketPairs: true,
          indentation: true
        },
        readOnly: shouldBeReadOnly
      });

      console.log('Monaco editor created successfully');

      // If there's no existing config, automatically start in edit mode
      if (!this.hasConfig) {
        console.log('No existing config, starting in edit mode');
        this.isEditing.set(true);
        this.editor.updateOptions({ readOnly: false });
        this.editor.focus();
      }

      // Listen for content changes
      this.editor.onDidChangeModelContent(() => {
        if (this.editor) {
          this.configText = this.editor.getValue();
        }
      });

      // Add JSON validation
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: false,
        schemas: []
      });

    } catch (error) {
      console.error('Error initializing Monaco editor:', error);
    }
  }

  private async loadMonacoEditor(): Promise<void> {
    console.log('loadMonacoEditor called');
    return new Promise((resolve, reject) => {
      // Check if Monaco is already loaded
      if (typeof monaco !== 'undefined') {
        console.log('Monaco already loaded');
        resolve();
        return;
      }

      console.log('Creating script element for Monaco');
      // Load Monaco editor from CDN with a more reliable URL
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/monaco-editor@0.45.0/min/vs/loader.js';
      
      script.onload = () => {
        console.log('Monaco script loaded, configuring require...');
        // Configure Monaco loader
        (window as any).require.config({ 
          paths: { 
            'vs': 'https://unpkg.com/monaco-editor@0.45.0/min/vs' 
          } 
        });
        (window as any).require(['vs/editor/editor.main'], () => {
          console.log('Monaco editor loaded successfully from CDN');
          resolve();
        });
      };
      
      script.onerror = (error) => {
        console.error('Failed to load Monaco editor from CDN:', error);
        reject(new Error('Failed to load Monaco editor'));
      };
      
      console.log('Adding script to document head');
      document.head.appendChild(script);
    });
  }

  updateHighlighting(): void {
    // This method is no longer needed with Monaco editor
    // Monaco handles syntax highlighting automatically
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


  startEditing(): void {
    this.isEditing.set(true);
    this.hasError.set(false);
    this.errorMessage.set('');
    
    // Update editor to editable mode
    if (this.editor) {
      this.editor.updateOptions({ readOnly: false });
    }
  }

  addConfiguration(): void {
    console.log('addConfiguration called');
    console.log('Editor exists:', !!this.editor);
    
    // Set editing state first
    this.isEditing.set(true);
    this.hasError.set(false);
    this.errorMessage.set('');
    
    // If editor doesn't exist yet, it will be handled in ngAfterViewInit
    if (!this.editor) {
      console.log('Editor not available yet, but editing state set');
      return;
    }
    
    // Update editor content and make it editable
    console.log('Updating editor with new content');
    this.editor.setValue('{\n  \n}');
    this.editor.updateOptions({ readOnly: false });
    this.editor.focus();
    console.log('Editor updated and focused');
  }

  cancelEditing(): void {
    // If there was no original config, just close the dialog
    if (!this.hasConfig) {
      this.onClose();
      return;
    }
    
    // Otherwise, restore original content and exit edit mode
    this.configText = this.originalConfigText;
    this.isEditing.set(false);
    this.hasError.set(false);
    this.errorMessage.set('');
    
    // Update editor to read-only mode and restore original content
    if (this.editor) {
      this.editor.setValue(this.originalConfigText);
      this.editor.updateOptions({ readOnly: true });
    }
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
