import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import * as Prism from 'prismjs';
import 'prismjs/components/prism-json';

@Component({
  selector: 'app-config-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './config-dialog.component.html',
  styleUrl: './config-dialog.component.css'
})
export class ConfigDialogComponent implements OnInit {
  constructor(
    public dialogRef: MatDialogRef<ConfigDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { categoryName: string, config: any }
  ) {}

  ngOnInit(): void {
    // Ensure Prism is loaded and JSON language is available
    if (typeof Prism !== 'undefined' && Prism.languages && Prism.languages['json']) {
      console.log('Prism.js and JSON language loaded successfully');
    } else {
      console.error('Prism.js or JSON language not loaded properly');
    }
  }

  get formattedConfig(): string {
    if (!this.data.config) return '';
    return JSON.stringify(this.data.config, null, 2);
  }

  get highlightedConfig(): string {
    if (!this.data.config) return '';
    
    const jsonString = JSON.stringify(this.data.config, null, 2);
    console.log('Original JSON string:', jsonString);
    
    // Check if Prism and JSON language are available
    if (typeof Prism === 'undefined' || !Prism.languages || !Prism.languages['json']) {
      console.error('Prism.js or JSON language not available, falling back to plain text');
      return jsonString;
    }
    
    try {
      const highlighted = Prism.highlight(jsonString, Prism.languages['json'], 'json');
      console.log('Highlighted HTML:', highlighted);
      return highlighted;
    } catch (error) {
      console.error('Error highlighting JSON:', error);
      return jsonString;
    }
  }

  onClose(): void {
    this.dialogRef.close();
  }
}
