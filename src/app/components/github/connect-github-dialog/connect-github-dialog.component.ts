import { Component, Inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';

export interface ConnectGithubDialogData {
  isConnected: boolean;
}

export type ConnectGithubDialogResult = { success: true } | { removed: true } | undefined;

@Component({
  selector: 'app-connect-github-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule
  ],
  templateUrl: './connect-github-dialog.component.html',
  styleUrl: './connect-github-dialog.component.css'
})
export class ConnectGithubDialogComponent {
  token = '';
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  constructor(
    public dialogRef: MatDialogRef<ConnectGithubDialogComponent, ConnectGithubDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: ConnectGithubDialogData,
    private apiService: ApiService
  ) {}

  get isConnected(): boolean {
    return this.data.isConnected;
  }

  connectOrUpdate(): void {
    const token = this.token.trim();
    if (!token) {
      this.errorMessage.set('Please enter a GitHub Personal Access Token.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.apiService.setGithubConnection(token).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.dialogRef.close({ success: true });
      },
      error: (err) => {
        this.isLoading.set(false);
        const status = err?.status;
        if (status === 401) {
          this.errorMessage.set('Invalid or expired token. Please check or regenerate your token.');
        } else if (status === 503) {
          this.errorMessage.set('Encryption is not available. Please contact your administrator.');
        } else {
          this.errorMessage.set('Failed to save token. Please try again.');
        }
      }
    });
  }

  disconnect(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.apiService.deleteGithubConnection().subscribe({
      next: () => {
        this.isLoading.set(false);
        this.dialogRef.close({ removed: true });
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('Failed to disconnect. Please try again.');
      }
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
