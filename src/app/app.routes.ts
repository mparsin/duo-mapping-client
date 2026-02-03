import { Routes } from '@angular/router';
import { MasterDetailComponent } from './components/master-detail/master-detail.component';
import { UploadConfigEditorComponent } from './components/upload-config-editor/upload-config-editor.component';

export const routes: Routes = [
  { path: '', component: MasterDetailComponent },
  { path: 'category/:id', component: MasterDetailComponent },
  { path: 'upload-config-editor', component: UploadConfigEditorComponent },
  { path: '**', redirectTo: '' }
];
