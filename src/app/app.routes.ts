import { Routes } from '@angular/router';
import { MasterDetailComponent } from './components/master-detail/master-detail.component';
import { AuthCallbackComponent } from './components/auth/auth-callback.component';
import { LoginPageComponent } from './components/auth/login-page.component';

export const routes: Routes = [
  { path: 'auth/callback', component: AuthCallbackComponent },
  { path: 'login', component: LoginPageComponent },
  { path: '', component: MasterDetailComponent },
  { path: 'category/:id', component: MasterDetailComponent },
  { path: '**', redirectTo: '' }
];
