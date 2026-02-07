import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import {
  ApiService,
  CreateSchemaPrBody,
  CreateSchemaPrResponse
} from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';

export type PushSchemaDialogResult =
  | { connectRequired: true }
  | { updateTokenRequired: true }
  | { prCreated: true; prUrl: string }
  | undefined;

@Component({
  selector: 'app-push-schema-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    FormsModule
  ],
  templateUrl: './push-schema-dialog.component.html',
  styleUrl: './push-schema-dialog.component.css'
})
export class PushSchemaDialogComponent {
  author: string;
  prTitle = 'Schema config update';
  prBody = '';

  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  prResult = signal<CreateSchemaPrResponse | null>(null);

  constructor(
    public dialogRef: MatDialogRef<PushSchemaDialogComponent, PushSchemaDialogResult>,
    private apiService: ApiService,
    private authService: AuthService
  ) {
    this.author = this.authService.getCurrentUserName();
  }

  get hasPrResult(): boolean {
    return this.prResult() !== null;
  }

  get canSubmit(): boolean {
    return !!(
      this.author.trim() &&
      this.prTitle.trim() &&
      !this.isLoading()
    );
  }

  submit(): void {
    if (!this.canSubmit) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const body: CreateSchemaPrBody = {
      author: this.author.trim(),
      pr_title: this.prTitle.trim()
    };
    const bodyText = this.prBody.trim();
    if (bodyText) {
      body.pr_body = bodyText;
    }

    this.apiService.createSchemaPr(body).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        this.prResult.set(response);
      },
      error: (err) => {
        this.isLoading.set(false);
        const status = err?.status;
        if (status === 412) {
          this.errorMessage.set('GitHub is not connected. Please connect GitHub first.');
          this.dialogRef.close({ connectRequired: true });
        } else if (status === 401) {
          this.errorMessage.set('Your GitHub token is invalid or expired. Please update your token.');
          this.dialogRef.close({ updateTokenRequired: true });
        } else if (status === 404) {
          this.errorMessage.set('Repository or base branch not found.');
        } else if (status === 422) {
          const msg = err?.error?.message ?? err?.error?.detail;
          this.errorMessage.set(
            (typeof msg === 'string' ? msg : null) ||
              'Branch may already exist. Try again or use a different branch name.'
          );
        } else {
          this.errorMessage.set('Failed to create pull request. Please try again.');
        }
      }
    });
  }

  openPr(): void {
    const result = this.prResult();
    if (result?.pr_url) {
      window.open(result.pr_url, '_blank');
    }
  }

  close(): void {
    const result = this.prResult();
    if (result) {
      this.dialogRef.close({ prCreated: true, prUrl: result.pr_url });
    } else {
      this.dialogRef.close();
    }
  }
}
