import { Component, OnDestroy, OnInit, AfterViewInit, computed, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule, ReactiveFormsModule, FormControl, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { TableSetsApi } from '../../api/table-sets.api';
import { UploadConfigApi } from '../../api/upload-config.api';
import { Category } from '../../models/category.model';
import { TableSet, UploadConfigEditorPayload } from '../../models/upload-config.model';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog.component';
import { MatTabsModule } from '@angular/material/tabs';

declare const monaco: any;

type DraftState = {
  jsonText: string;
  originalJsonText: string;
  isJsonValid: boolean;
};

type NameDraftState = {
  nameText: string;
  originalNameText: string;
};

let monacoLoaderPromise: Promise<void> | null = null;

@Component({
  selector: 'app-upload-config-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DragDropModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatTabsModule
  ],
  templateUrl: './upload-config-editor.component.html',
  styleUrl: './upload-config-editor.component.css'
})
export class UploadConfigEditorComponent implements OnInit, AfterViewInit, OnDestroy {
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  tableSets = signal<TableSet[]>([]);
  categories = signal<Category[]>([]);
  unassignedCategories = signal<Category[]>([]);

  selectedSetId = signal<number | null>(null);
  selectedCategoryId = signal<number | null>(null);

  hasSelection = computed(() => this.selectedSetId() !== null);
  selectedSet = computed(() => this.tableSets().find(s => s.id === this.selectedSetId()) || null);
  selectedCategory = computed(
    () => this.categories().find(c => c.id === this.selectedCategoryId()) || null
  );
  selectedDraft = computed(() => {
    const cat = this.selectedCategory();
    if (!cat) return null;
    return this.drafts()[String(cat.id)] || null;
  });

  categoriesInSelectedSet = computed(() => {
    const setId = this.selectedSetId();
    if (setId === null) return [];
    return this.sortCategoriesByLineNo(
      this.categories().filter(c => (c.table_set_id ?? null) === setId)
    );
  });

  computedUnassigned = computed(() => {
    // Keep unassigned as a separate signal so we can optimistically move items.
    return this.unassignedCategories();
  });

  // Table set edit/create UI state
  newSetName = '';
  newSetSeqNoText = '';
  isCreatingSet = signal<boolean>(false);

  editingSetId = signal<number | null>(null);
  editingSetName = '';
  isSavingSet = signal<boolean>(false);

  isReorderingSets = signal<boolean>(false);
  deletingSetId = signal<number | null>(null);

  isReorderingTables = signal<boolean>(false);
  updatingCategoryId = signal<number | null>(null);

  drafts = signal<Record<string, DraftState>>({});
  nameDrafts = signal<Record<string, NameDraftState>>({});

  // Config editor UI
  editorTabIndex = signal<number>(0); // 0 = Form, 1 = Raw JSON
  isSavingConfig = signal<boolean>(false);

  previewLoading = signal<boolean>(false);
  previewError = signal<string | null>(null);
  previewJsonText = signal<string | null>(null);

  configForm = new FormGroup({
    table: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    endpoint: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    batch_size: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(1), UploadConfigEditorComponent.positiveInteger]
    })
  });

  categoryNameControl = new FormControl<string>('', { nonNullable: true, validators: [Validators.required] });

  @ViewChild('rawEditor', { static: false }) rawEditorElement?: ElementRef<HTMLElement>;
  private rawEditor: any = null;
  private syncingEditorValue = false;
  private syncingFormValue = false;

  private subs = new Subscription();

  constructor(
    private tableSetsApi: TableSetsApi,
    private uploadConfigApi: UploadConfigApi,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.reload();

    const formSub = this.configForm.valueChanges.subscribe(() => {
      if (this.syncingFormValue) return;
      const cat = this.selectedCategory();
      if (!cat) return;
      this.updateDraftFromForm(cat.id);
    });
    this.subs.add(formSub);

    const nameSub = this.categoryNameControl.valueChanges.subscribe(() => {
      if (this.syncingFormValue) return;
      const cat = this.selectedCategory();
      if (!cat) return;
      this.updateNameDraftFromControl(cat.id);
    });
    this.subs.add(nameSub);
  }

  ngOnDestroy(): void {
    if (this.rawEditor) {
      this.rawEditor.dispose();
      this.rawEditor = null;
    }
    this.subs.unsubscribe();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);

    const sub = this.uploadConfigApi
      .getEditorData()
      .pipe(
        catchError(() => {
          // Fallback to separate endpoints if editor endpoint isn't available.
          return forkJoin({
            sets: this.tableSetsApi.listTableSets(),
            categories: this.uploadConfigApi.getCategories()
          }).pipe(
            map(({ sets, categories }) => {
              const unassigned = categories.filter(
                c => (c.table_set_id ?? null) === null && c.config != null
              );
              return { sets, categories, unassigned } satisfies UploadConfigEditorPayload & {
                categories: Category[];
              };
            })
          );
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        next: (payloadOrFallback: any) => {
          const sets: TableSet[] = (payloadOrFallback.sets || []).map((s: any) =>
            this.normalizeTableSet(s)
          );
          const unassigned: Category[] = payloadOrFallback.unassigned || [];

          // If the editor payload includes categories per set, flatten them.
          const flattenedCategories: Category[] = [];
          if (Array.isArray(payloadOrFallback.sets)) {
            for (const s of payloadOrFallback.sets) {
              if (Array.isArray(s.categories)) {
                flattenedCategories.push(...s.categories);
              }
              // Current editor endpoint returns `tables` under each set.
              if (Array.isArray(s.tables)) {
                const setId = Number(s.table_set_id ?? s.id);
                for (const t of s.tables) {
                  const cat = this.normalizeEditorTableAsCategory(t, setId);
                  if (cat) flattenedCategories.push(cat);
                }
              }
            }
          }

          let categories: Category[] =
            (payloadOrFallback.categories as Category[] | undefined) ||
            (flattenedCategories.length > 0 ? flattenedCategories : this.categories());

          // Ensure unassigned categories exist in the global categories list so assign/unassign can update them.
          if (unassigned.length > 0) {
            const byId = new Map<number, Category>();
            for (const c of categories) byId.set(c.id, c);
            for (const c of unassigned) byId.set(c.id, c);
            categories = Array.from(byId.values());
          }

          this.tableSets.set(this.sortTableSets(sets));
          this.categories.set(categories);
          this.unassignedCategories.set(
            unassigned.length > 0
              ? unassigned
              : categories.filter(c => (c.table_set_id ?? null) === null && c.config != null)
          );

          if (this.selectedSetId() === null && this.tableSets().length > 0) {
            this.selectedSetId.set(this.tableSets()[0].id);
          }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        error: (err: any) => {
          const msg =
            err?.error?.detail ||
            err?.error?.message ||
            err?.message ||
            'Failed to load upload config editor data.';
          this.error.set(String(msg));
        }
      });

    this.subs.add(sub);
  }

  selectSet(tableSetId: number): void {
    this.selectedSetId.set(tableSetId);
    this.selectedCategoryId.set(null);
  }

  selectCategory(categoryId: number): void {
    this.selectedCategoryId.set(categoryId);
    this.ensureDraft(categoryId);
    this.ensureNameDraft(categoryId);
    this.syncEditorAndFormFromDraft(categoryId);
    this.syncNameControlFromDraft(categoryId);
  }

  onEditorTabIndexChange(idx: number): void {
    this.editorTabIndex.set(idx);
    const cat = this.selectedCategory();
    if (!cat) return;

    // When switching tabs, try to keep form/JSON in sync.
    if (idx === 0) {
      // entering Form: if JSON valid, populate form from JSON draft
      this.syncFormFromDraft(cat.id);
    } else if (idx === 1) {
      // entering JSON: push latest draft to Monaco editor
      // MatTab content is lazy, so init Monaco after it renders.
      setTimeout(() => {
        void this.initRawEditorIfNeeded().then(() => this.syncMonacoFromDraft(cat.id));
      }, 0);
    }
  }

  isCategoryDirty(categoryId: number): boolean {
    const d = this.drafts()[String(categoryId)];
    const jsonDirty = !!d && d.jsonText !== d.originalJsonText;
    const n = this.nameDrafts()[String(categoryId)];
    const nameDirty = !!n && n.nameText !== n.originalNameText;
    return jsonDirty || nameDirty;
  }

  canSaveSelected(): boolean {
    const cat = this.selectedCategory();
    if (!cat) return false;
    if (!this.isCategoryDirty(cat.id)) return false;

    const d = this.drafts()[String(cat.id)];
    if (!d || !d.isJsonValid) return false;

    // Require a non-empty category name.
    const n = this.nameDrafts()[String(cat.id)];
    const nameText = (n?.nameText ?? this.categoryNameControl.value).trim();
    if (!nameText) return false;
    return true;
  }

  resetSelectedDraft(): void {
    const cat = this.selectedCategory();
    if (!cat) return;
    const d = this.drafts()[String(cat.id)];
    if (!d) return;

    this.setDraft(cat.id, { ...d, jsonText: d.originalJsonText, isJsonValid: this.isValidJson(d.originalJsonText) });
    this.syncEditorAndFormFromDraft(cat.id);
  }

  saveSelectedConfig(): void {
    const cat = this.selectedCategory();
    if (!cat) return;
    const d = this.drafts()[String(cat.id)];
    if (!d) return;

    const parsed = this.tryParseJson(d.jsonText);
    if (!parsed.ok) {
      this.snackBar.open('Invalid JSON: cannot save.', 'Close', {
        duration: 4000,
        horizontalPosition: 'center',
        verticalPosition: 'top',
        panelClass: 'error-snackbar'
      });
      return;
    }

    const validationError = this.validateRequiredUploadConfigFields(parsed.value);
    if (validationError) {
      this.snackBar.open(validationError, 'Close', {
        duration: 5000,
        horizontalPosition: 'center',
        verticalPosition: 'top',
        panelClass: 'error-snackbar'
      });
      this.editorTabIndex.set(0);
      this.syncFormFromDraft(cat.id);
      return;
    }

    const nameDraft = this.nameDrafts()[String(cat.id)];
    const nextName = (nameDraft?.nameText ?? this.categoryNameControl.value).trim();
    const nameDirty = !!nameDraft && nameDraft.nameText !== nameDraft.originalNameText;

    const configDirty = d.jsonText !== d.originalJsonText;

    // Only call endpoints that actually have changes.
    const configOp = configDirty ? this.uploadConfigApi.updateCategoryConfig(cat.id, parsed.value) : of(cat);
    const metadataOp = nameDirty
      ? this.uploadConfigApi.updateCategoryUploadMetadata(cat.id, {
          table_set_id: cat.table_set_id ?? null,
          line_no: cat.line_no ?? null,
          Name: nextName
        })
      : of(cat);

    this.isSavingConfig.set(true);
    const sub = forkJoin([configOp, metadataOp])
      .pipe(finalize(() => this.isSavingConfig.set(false)))
      .subscribe({
        next: ([configResp, metaResp]) => {
          const current = this.categories().find(c => c.id === cat.id) || cat;
          const merged: Category = {
            ...current,
            ...metaResp,
            ...configResp,
            // Preserve upload-metadata if omitted by partial responses.
            table_set_id:
              (metaResp as any).table_set_id !== undefined
                ? (metaResp as any).table_set_id
                : (configResp as any).table_set_id !== undefined
                  ? (configResp as any).table_set_id
                  : current.table_set_id,
            line_no:
              (metaResp as any).line_no !== undefined
                ? (metaResp as any).line_no
                : (configResp as any).line_no !== undefined
                  ? (configResp as any).line_no
                  : current.line_no,
            Name: (metaResp as any).Name !== undefined ? (metaResp as any).Name : current.Name
          };

          this.categories.set(this.categories().map(c => (c.id === merged.id ? merged : c)));

          // Reset drafts to clean state.
          const newOriginalJson = JSON.stringify(merged.config ?? {}, null, 2);
          this.setDraft(merged.id, {
            jsonText: newOriginalJson,
            originalJsonText: newOriginalJson,
            isJsonValid: true
          });
          this.setNameDraft(merged.id, { nameText: merged.Name, originalNameText: merged.Name });
          this.syncEditorAndFormFromDraft(merged.id);
          this.syncNameControlFromDraft(merged.id);

          this.snackBar.open('Saved.', 'Close', {
            duration: 2000,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        error: (err: any) => {
          const msg = err?.error?.detail || err?.error?.message || err?.message || err?.error || 'Failed to save.';
          this.snackBar.open(this.toToastMessage(msg), 'Close', {
            duration: 6000,
            horizontalPosition: 'center',
            verticalPosition: 'top',
            panelClass: 'error-snackbar'
          });
        }
      });
    this.subs.add(sub);
  }

  previewUploadConfig(): void {
    this.previewLoading.set(true);
    this.previewError.set(null);

    const sub = this.uploadConfigApi
      .previewUploadConfigText()
      .pipe(finalize(() => this.previewLoading.set(false)))
      .subscribe({
        next: (text: string) => {
          try {
            const obj = JSON.parse(text);
            this.previewJsonText.set(JSON.stringify(obj, null, 2));
          } catch {
            // If backend returns non-JSON text, still show it.
            this.previewJsonText.set(text);
          }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        error: (err: any) => {
          const msg =
            err?.error?.detail || err?.error?.message || err?.message || 'Failed to preview upload-config.json.';
          this.previewError.set(String(msg));
        }
      });
    this.subs.add(sub);
  }

  downloadUploadConfig(): void {
    const sub = this.uploadConfigApi.downloadUploadConfigBlob().subscribe({
      next: (blob: Blob) => {
        this.downloadBlob(blob, 'upload-config.json');
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: (err: any) => {
        const msg =
          err?.error?.detail || err?.error?.message || err?.message || 'Failed to download upload-config.json.';
        this.snackBar.open(String(msg), 'Close', {
          duration: 6000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: 'error-snackbar'
        });
      }
    });
    this.subs.add(sub);
  }

  startRename(set: TableSet): void {
    this.editingSetId.set(set.id);
    this.editingSetName = set.name;
  }

  cancelRename(): void {
    this.editingSetId.set(null);
    this.editingSetName = '';
  }

  saveRename(set: TableSet): void {
    const newName = this.editingSetName.trim();
    if (!newName) {
      this.snackBar.open('Set name is required.', 'Close', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    if (newName === set.name) {
      this.cancelRename();
      return;
    }

    this.isSavingSet.set(true);
    const sub = this.tableSetsApi
      .updateTableSet(set.id, { name: newName })
      .pipe(finalize(() => this.isSavingSet.set(false)))
      .subscribe({
        next: updated => {
          this.tableSets.set(
            this.sortTableSets(this.tableSets().map(s => (s.id === updated.id ? updated : s)))
          );
          this.cancelRename();
          this.snackBar.open('Set renamed.', 'Close', {
            duration: 2000,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        error: (err: any) => {
          const msg = err?.error?.detail || err?.error?.message || err?.message || 'Rename failed.';
          this.snackBar.open(String(msg), 'Close', {
            duration: 5000,
            horizontalPosition: 'center',
            verticalPosition: 'top',
            panelClass: 'error-snackbar'
          });
        }
      });
    this.subs.add(sub);
  }

  createSet(): void {
    const name = this.newSetName.trim();
    if (!name) {
      this.snackBar.open('Set name is required.', 'Close', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    const seqNo = this.parseOptionalInt(this.newSetSeqNoText);
    if (this.newSetSeqNoText.trim() && seqNo === null) {
      this.snackBar.open('Seq No must be an integer (or blank).', 'Close', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    this.isCreatingSet.set(true);
    const sub = this.tableSetsApi
      .createTableSet(seqNo === null ? { name } : { name, seq_no: seqNo })
      .pipe(finalize(() => this.isCreatingSet.set(false)))
      .subscribe({
        next: created => {
          this.tableSets.set(this.sortTableSets([...this.tableSets(), created]));
          this.newSetName = '';
          this.newSetSeqNoText = '';
          this.selectedSetId.set(created.id);
          this.snackBar.open('Set created.', 'Close', {
            duration: 2000,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        error: (err: any) => {
          const msg =
            err?.error?.detail || err?.error?.message || err?.message || 'Create set failed.';
          this.snackBar.open(String(msg), 'Close', {
            duration: 5000,
            horizontalPosition: 'center',
            verticalPosition: 'top',
            panelClass: 'error-snackbar'
          });
        }
      });
    this.subs.add(sub);
  }

  onSetDrop(event: CdkDragDrop<TableSet[]>): void {
    if (this.isReorderingSets()) return;

    const prev = this.tableSets();
    const next = [...prev];
    moveItemInArray(next, event.previousIndex, event.currentIndex);

    const optimistic = next.map((s, idx) => ({ ...s, seq_no: (idx + 1) * 10 }));
    this.tableSets.set(optimistic);
    this.isReorderingSets.set(true);

    const items = optimistic.map(s => ({ id: s.id, seq_no: s.seq_no ?? 0 }));
    // Persist reorder. If the backend's `/table-sets/reorder` route is shadowed (422),
    // the most reliable approach is to update each set's `seq_no` individually.
    const patchCalls = items.map(i => this.tableSetsApi.updateTableSet(i.id, { seq_no: i.seq_no }));
    const sub = forkJoin(patchCalls)
      .pipe(finalize(() => this.isReorderingSets.set(false)))
      .subscribe({
        next: updated => {
          this.tableSets.set(this.sortTableSets(updated));
          this.snackBar.open('Set order saved.', 'Close', {
            duration: 2500,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        error: (err: any) => {
          this.tableSets.set(prev);
          this.snackBar.open(this.toToastMessage(err?.error ?? err?.message ?? err) || 'Failed to reorder sets.', 'Close', {
            duration: 6000,
            horizontalPosition: 'center',
            verticalPosition: 'top',
            panelClass: 'error-snackbar'
          });
        }
      });
    this.subs.add(sub);
  }

  deleteSet(set: TableSet): void {
    if (this.deletingSetId() !== null) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '520px',
      data: {
        title: 'Delete table set?',
        message: `Delete "${set.name}"? This cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        confirmColor: 'warn'
      }
    });

    const sub = dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;

      this.deletingSetId.set(set.id);
      const delSub = this.tableSetsApi
        .deleteTableSet(set.id)
        .pipe(finalize(() => this.deletingSetId.set(null)))
        .subscribe({
          next: () => {
            this.tableSets.set(this.tableSets().filter(s => s.id !== set.id));
            if (this.selectedSetId() === set.id) {
              this.selectedSetId.set(this.tableSets().length ? this.tableSets()[0].id : null);
              this.selectedCategoryId.set(null);
            }
            this.snackBar.open('Set deleted.', 'Close', {
              duration: 2000,
              horizontalPosition: 'center',
              verticalPosition: 'top'
            });
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          error: (err: any) => {
            const msg =
              err?.error?.detail || err?.error?.message || err?.message || 'Delete failed.';
            this.snackBar.open(this.toToastMessage(msg), 'Close', {
              duration: 6000,
              horizontalPosition: 'center',
              verticalPosition: 'top',
              panelClass: 'error-snackbar'
            });
          }
        });
      this.subs.add(delSub);
    });

    this.subs.add(sub);
  }

  onTableDrop(event: CdkDragDrop<Category[]>): void {
    if (this.isReorderingTables()) return;
    const setId = this.selectedSetId();
    if (setId === null) return;

    const currentList = this.categoriesInSelectedSet();
    const nextList = [...currentList];
    moveItemInArray(nextList, event.previousIndex, event.currentIndex);

    const prevLineNos = new Map<number, number | null>();
    for (const c of currentList) prevLineNos.set(c.id, c.line_no ?? null);

    const updatedLineNos = new Map<number, number | null>();
    for (let i = 0; i < nextList.length; i++) {
      updatedLineNos.set(nextList[i].id, (i + 1) * 10);
    }

    // Optimistically update local state.
    this.categories.set(
      this.categories().map(c => {
        const nextLineNo = updatedLineNos.get(c.id);
        if (nextLineNo === undefined) return c;
        return { ...c, table_set_id: setId, line_no: nextLineNo };
      })
    );

    this.isReorderingTables.set(true);
    const items = nextList.map((c, idx) => ({
      category_id: c.id,
      table_set_id: setId,
      line_no: (idx + 1) * 10
    }));

    const sub = this.uploadConfigApi
      .reorderUploadOrder(items)
      .pipe(finalize(() => this.isReorderingTables.set(false)))
      .subscribe({
        next: () => {
          // already applied optimistically
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        error: (err: any) => {
          // rollback
          this.categories.set(
            this.categories().map(c => {
              if (!prevLineNos.has(c.id)) return c;
              return { ...c, line_no: prevLineNos.get(c.id) ?? null };
            })
          );
          const msg =
            err?.error?.detail ||
            err?.error?.message ||
            err?.message ||
            'Failed to reorder tables. Changes were reverted.';
          this.snackBar.open(this.toToastMessage(msg), 'Close', {
            duration: 6000,
            horizontalPosition: 'center',
            verticalPosition: 'top',
            panelClass: 'error-snackbar'
          });
        }
      });
    this.subs.add(sub);
  }

  assignUnassigned(category: Category): void {
    const setId = this.selectedSetId();
    if (setId === null) {
      this.snackBar.open('Select a table set first.', 'Close', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }
    if (this.updatingCategoryId() !== null) return;

    const currentInSet = this.categoriesInSelectedSet();
    const maxLineNo = currentInSet.reduce((max, c) => {
      const n = c.line_no;
      return n != null && n > max ? n : max;
    }, 0);
    const nextLineNo = maxLineNo + 10;

    // optimistic move
    const prevCategories = this.categories();
    const prevUnassigned = this.unassignedCategories();

    this.updatingCategoryId.set(category.id);
    const updatedLocal: Category = { ...category, table_set_id: setId, line_no: nextLineNo };
    this.categories.set(
      prevCategories.some(c => c.id === category.id)
        ? prevCategories.map(c => (c.id === category.id ? updatedLocal : c))
        : [...prevCategories, updatedLocal]
    );
    this.unassignedCategories.set(prevUnassigned.filter(c => c.id !== category.id));

    const sub = this.uploadConfigApi
      .updateCategoryUploadMetadata(category.id, { table_set_id: setId, line_no: nextLineNo })
      .pipe(finalize(() => this.updatingCategoryId.set(null)))
      .subscribe({
        next: updated => {
          // ensure local reflects server response
          this.categories.set(this.categories().map(c => (c.id === updated.id ? updated : c)));
          this.snackBar.open('Assigned to set.', 'Close', {
            duration: 2000,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        error: (err: any) => {
          this.categories.set(prevCategories);
          this.unassignedCategories.set(prevUnassigned);
          const msg =
            err?.error?.detail ||
            err?.error?.message ||
            err?.message ||
            'Failed to assign category.';
          this.snackBar.open(this.toToastMessage(msg), 'Close', {
            duration: 6000,
            horizontalPosition: 'center',
            verticalPosition: 'top',
            panelClass: 'error-snackbar'
          });
        }
      });
    this.subs.add(sub);
  }

  unassignFromSet(category: Category): void {
    if (this.updatingCategoryId() !== null) return;

    const prevCategories = this.categories();
    const prevUnassigned = this.unassignedCategories();

    this.updatingCategoryId.set(category.id);
    this.categories.set(
      prevCategories.map(c =>
        c.id === category.id ? { ...c, table_set_id: null, line_no: null } : c
      )
    );
    if (category.config != null && !prevUnassigned.some(c => c.id === category.id)) {
      this.unassignedCategories.set([category, ...prevUnassigned]);
    }

    const sub = this.uploadConfigApi
      .updateCategoryUploadMetadata(category.id, { table_set_id: null, line_no: null })
      .pipe(finalize(() => this.updatingCategoryId.set(null)))
      .subscribe({
        next: updated => {
          this.categories.set(this.categories().map(c => (c.id === updated.id ? updated : c)));
          // Keep unassigned list in sync (ensure it contains server-updated version)
          if (updated.config != null) {
            this.unassignedCategories.set([
              updated,
              ...this.unassignedCategories().filter(c => c.id !== updated.id)
            ]);
          } else {
            this.unassignedCategories.set(this.unassignedCategories().filter(c => c.id !== updated.id));
          }
          this.snackBar.open('Unassigned.', 'Close', {
            duration: 2000,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        error: (err: any) => {
          this.categories.set(prevCategories);
          this.unassignedCategories.set(prevUnassigned);
          const msg =
            err?.error?.detail ||
            err?.error?.message ||
            err?.message ||
            'Failed to unassign category.';
          this.snackBar.open(this.toToastMessage(msg), 'Close', {
            duration: 6000,
            horizontalPosition: 'center',
            verticalPosition: 'top',
            panelClass: 'error-snackbar'
          });
        }
      });
    this.subs.add(sub);
  }

  private sortTableSets(sets: TableSet[]): TableSet[] {
    return [...sets].sort((a, b) => {
      const aNull = a.seq_no == null;
      const bNull = b.seq_no == null;
      if (aNull !== bNull) return aNull ? 1 : -1; // nulls last
      if ((a.seq_no ?? 0) !== (b.seq_no ?? 0)) return (a.seq_no ?? 0) - (b.seq_no ?? 0);
      return a.id - b.id;
    });
  }

  // Normalize editor payload table sets to our `{id, name, seq_no}` shape.
  // Backend may return `table_set_id` + `set_name`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeTableSet(raw: any): TableSet {
    const id = Number(raw?.id ?? raw?.table_set_id ?? raw?.tableSetId);
    const seqNoRaw = raw?.seq_no ?? raw?.seqNo ?? raw?.seq ?? null;
    const seq_no = seqNoRaw === null || seqNoRaw === undefined ? null : Number(seqNoRaw);

    const nameRaw =
      raw?.name ??
      raw?.Name ??
      raw?.set_name ??
      raw?.setName ??
      raw?.table_set_name ??
      raw?.tableSetName ??
      raw?.display_name ??
      raw?.displayName ??
      '';
    const name = String(nameRaw || '').trim() || `Set ${id}`;

    return { id, name, seq_no: Number.isFinite(seq_no as number) ? (seq_no as number) : null };
  }

  // Editor endpoint returns `tables` under each set.
  // Convert each entry into a Category-like object so the rest of the UI works.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeEditorTableAsCategory(raw: any, setId: number): Category | null {
    const id = Number(raw?.category_id ?? raw?.categoryId ?? raw?.id);
    if (!Number.isFinite(id)) return null;

    const lineNoRaw = raw?.line_no ?? raw?.lineNo ?? null;
    const line_no = lineNoRaw === null || lineNoRaw === undefined ? null : Number(lineNoRaw);

    const configRaw = raw?.config ?? raw?.upload_config ?? raw?.uploadConfig ?? null;
    const looksLikeConfig =
      raw &&
      typeof raw === 'object' &&
      (raw.table !== undefined || raw.endpoint !== undefined || raw.batch_size !== undefined);
    const config = configRaw ?? (looksLikeConfig ? raw : null);

    const nameRaw =
      raw?.Name ??
      raw?.name ??
      raw?.category_name ??
      raw?.categoryName ??
      raw?.table ??
      raw?.table_name ??
      raw?.tableName ??
      (config && (config as any).table) ??
      `Category ${id}`;

    return {
      id,
      Name: String(nameRaw),
      table_set_id: Number.isFinite(setId) ? setId : null,
      line_no: Number.isFinite(line_no as number) ? (line_no as number) : null,
      config: config ?? undefined
    };
  }

  private sortCategoriesByLineNo(categories: Category[]): Category[] {
    return [...categories].sort((a, b) => {
      const aNull = a.line_no == null;
      const bNull = b.line_no == null;
      if (aNull !== bNull) return aNull ? 1 : -1; // nulls last
      if ((a.line_no ?? 0) !== (b.line_no ?? 0)) return (a.line_no ?? 0) - (b.line_no ?? 0);
      return a.id - b.id;
    });
  }

  private parseOptionalInt(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (!Number.isInteger(n)) return null;
    return n;
  }

  private toToastMessage(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value == null) return 'Unknown error';

    // FastAPI often returns {detail: "..."} or {detail: {...}}
    if (typeof value === 'object') {
      const anyVal = value as any;
      const detail = anyVal?.detail ?? anyVal?.message ?? anyVal?.error;
      if (typeof detail === 'string' && detail.trim()) return detail;
      // FastAPI validation errors often return an array of {loc, msg, type, input}
      const array = Array.isArray(anyVal) ? anyVal : Array.isArray(detail) ? detail : null;
      if (array) {
        return array
          .map((e: any) => {
            const loc = Array.isArray(e?.loc) ? e.loc.join('.') : '';
            const msg = e?.msg ?? e?.message ?? e?.detail ?? 'Validation error';
            const input = e?.input !== undefined ? ` (got ${JSON.stringify(e.input)})` : '';
            return loc ? `${loc}: ${msg}${input}` : `${msg}${input}`;
          })
          .join('; ');
      }
      try {
        return JSON.stringify(value);
      } catch {
        // fallthrough
      }
    }

    return String(value);
  }

  // Note: backend currently shadows `/table-sets/reorder` with `/table-sets/{table_set_id}`.
  // We avoid calling `/reorder` from the UI and persist ordering via per-item PATCH instead.

  private downloadBlob(blob: Blob, filename: string): void {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  private ensureDraft(categoryId: number): void {
    const key = String(categoryId);
    if (this.drafts()[key]) return;

    const cat = this.categories().find(c => c.id === categoryId);
    const base = cat?.config ?? {};
    const text = JSON.stringify(base, null, 2) || '{\n  \n}';
    this.setDraft(categoryId, {
      jsonText: text,
      originalJsonText: text,
      isJsonValid: true
    });
  }

  private setDraft(categoryId: number, draft: DraftState): void {
    const key = String(categoryId);
    this.drafts.set({ ...this.drafts(), [key]: draft });
  }

  private ensureNameDraft(categoryId: number): void {
    const key = String(categoryId);
    if (this.nameDrafts()[key]) return;
    const cat = this.categories().find(c => c.id === categoryId);
    const name = (cat?.Name ?? '').toString();
    this.setNameDraft(categoryId, { nameText: name, originalNameText: name });
  }

  private setNameDraft(categoryId: number, draft: NameDraftState): void {
    const key = String(categoryId);
    this.nameDrafts.set({ ...this.nameDrafts(), [key]: draft });
  }

  private syncNameControlFromDraft(categoryId: number): void {
    const d = this.nameDrafts()[String(categoryId)];
    if (!d) return;
    this.syncingFormValue = true;
    this.categoryNameControl.setValue(d.nameText, { emitEvent: false });
    this.syncingFormValue = false;
  }

  private updateNameDraftFromControl(categoryId: number): void {
    const key = String(categoryId);
    const current = this.nameDrafts()[key];
    if (!current) return;
    const nameText = this.categoryNameControl.value.trim();
    this.setNameDraft(categoryId, { ...current, nameText });
  }

  private updateDraftFromForm(categoryId: number): void {
    const key = String(categoryId);
    const current = this.drafts()[key];
    if (!current) return;

    const parsed = this.tryParseJson(current.jsonText);
    const base = parsed.ok
      ? parsed.value
      : (this.categories().find(c => c.id === categoryId)?.config ?? {});

    const updated = {
      ...(base && typeof base === 'object' ? base : {}),
      table: this.configForm.controls.table.value.trim(),
      endpoint: this.configForm.controls.endpoint.value.trim(),
      batch_size: this.configForm.controls.batch_size.value ?? undefined
    };

    const nextText = JSON.stringify(updated, null, 2);
    const nextDraft: DraftState = {
      ...current,
      jsonText: nextText,
      isJsonValid: true
    };
    this.setDraft(categoryId, nextDraft);
    this.syncMonacoFromDraft(categoryId);
  }

  private syncEditorAndFormFromDraft(categoryId: number): void {
    this.syncFormFromDraft(categoryId);
    this.syncMonacoFromDraft(categoryId);
  }

  private syncFormFromDraft(categoryId: number): void {
    const d = this.drafts()[String(categoryId)];
    if (!d) return;
    const parsed = this.tryParseJson(d.jsonText);
    if (!parsed.ok) return;

    const obj: any = parsed.value && typeof parsed.value === 'object' ? parsed.value : {};
    this.syncingFormValue = true;
    this.configForm.setValue(
      {
        table: (obj.table ?? '') as string,
        endpoint: (obj.endpoint ?? '') as string,
        batch_size: (obj.batch_size ?? null) as number | null
      },
      { emitEvent: false }
    );
    this.syncingFormValue = false;
  }

  private syncMonacoFromDraft(categoryId: number): void {
    if (!this.rawEditor) return;
    const d = this.drafts()[String(categoryId)];
    if (!d) return;
    if (this.syncingEditorValue) return;

    this.syncingEditorValue = true;
    try {
      this.rawEditor.setValue(d.jsonText);
    } finally {
      this.syncingEditorValue = false;
    }
  }

  private tryParseJson(text: string): { ok: true; value: unknown } | { ok: false; error: unknown } {
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch (error) {
      return { ok: false, error };
    }
  }

  private isValidJson(text: string): boolean {
    return this.tryParseJson(text).ok;
  }

  private validateRequiredUploadConfigFields(config: any): string | null {
    if (!config || typeof config !== 'object') return 'Config must be a JSON object.';
    if (!config.table || typeof config.table !== 'string' || !config.table.trim()) {
      return 'Field "table" is required and must be a non-empty string.';
    }
    // if (!config.endpoint || typeof config.endpoint !== 'string' || !config.endpoint.trim()) {
    //   return 'Field "endpoint" is required and must be a non-empty string.';
    // }
    // const n = config.batch_size;
    // if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0) {
    //   return 'Field "batch_size" is required and must be a positive integer.';
    // }
    return null;
  }

  private async ensureMonacoLoaded(): Promise<void> {
    if (typeof monaco !== 'undefined') return;
    if (monacoLoaderPromise) return monacoLoaderPromise;

    monacoLoaderPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/monaco-editor@0.45.0/min/vs/loader.js';
      script.onload = () => {
        (window as any).require.config({
          paths: { vs: 'https://unpkg.com/monaco-editor@0.45.0/min/vs' }
        });
        (window as any).require(['vs/editor/editor.main'], () => resolve());
      };
      script.onerror = () => reject(new Error('Failed to load Monaco editor'));
      document.head.appendChild(script);
    });

    return monacoLoaderPromise;
  }

  async ngAfterViewInit(): Promise<void> {
    // Monaco is created lazily when the Raw JSON tab is opened.
    if (this.editorTabIndex() === 1) {
      await this.initRawEditorIfNeeded();
    }
  }

  private async initRawEditorIfNeeded(): Promise<void> {
    if (this.rawEditor) return;

    try {
      await this.ensureMonacoLoaded();
    } catch {
      // Monaco is optional; form editing still works.
      return;
    }

    if (!this.rawEditorElement) return;

    this.rawEditor = monaco.editor.create(this.rawEditorElement.nativeElement, {
      value: '{\n  \n}',
      language: 'json',
      theme: 'vs',
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 13,
      tabSize: 2,
      insertSpaces: true
    });

    this.rawEditor.onDidChangeModelContent(() => {
      if (this.syncingEditorValue) return;
      const cat = this.selectedCategory();
      if (!cat) return;

      const current = this.drafts()[String(cat.id)];
      if (!current) return;

      const nextText = this.rawEditor.getValue();
      const parsed = this.tryParseJson(nextText);
      this.setDraft(cat.id, { ...current, jsonText: nextText, isJsonValid: parsed.ok });

      if (parsed.ok) this.syncFormFromDraft(cat.id);
    });

    const selectedId = this.selectedCategoryId();
    if (selectedId !== null) {
      this.ensureDraft(selectedId);
      this.syncMonacoFromDraft(selectedId);
    }
  }

  private static positiveInteger(control: AbstractControl): ValidationErrors | null {
    const v = control.value;
    if (v === null || v === undefined || v === '') return null;
    if (typeof v !== 'number') return { positiveInteger: true };
    if (!Number.isInteger(v) || v <= 0) return { positiveInteger: true };
    return null;
  }
}

