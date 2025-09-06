import { Routes } from '@angular/router';
import { MasterDetailComponent } from './components/master-detail/master-detail.component';

export const routes: Routes = [
  { path: '', component: MasterDetailComponent },
  { path: '**', redirectTo: '' }
];
