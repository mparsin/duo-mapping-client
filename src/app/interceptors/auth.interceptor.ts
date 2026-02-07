import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

/** True if this request is to our backend API and should carry the Bearer token. */
function isApiRequest(url: string): boolean {
  const u = url.toLowerCase();
  const apiUrl = environment.apiUrl?.toLowerCase() ?? '';
  const cognitoApiUrl = environment.cognito?.apiUrl?.toLowerCase() ?? '';
  if (apiUrl.length > 0 && u.startsWith(apiUrl)) return true;
  if (cognitoApiUrl.length > 0 && u.startsWith(cognitoApiUrl)) return true;
  if (u.startsWith('/api')) return true;
  try {
    const pathname = new URL(url, 'http://localhost').pathname.toLowerCase();
    return pathname.startsWith('/api');
  } catch {
    return false;
  }
}

/** True if we're on the OAuth callback URL; do not redirect to login here so init() can finish. */
function isOAuthCallback(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  const search = window.location.search;
  return path === '/auth/callback' || (search.includes('code=') && search.includes('state='));
}

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const authService = inject(AuthService);

  if (!isApiRequest(req.url)) {
    return next(req);
  }

  const token = authService.getAccessToken();
  if (!token) {
    if (isOAuthCallback()) {
      return throwError(() => new HttpErrorResponse({ status: 401, error: 'Not authenticated' }));
    }
    authService.login();
    return throwError(() => new HttpErrorResponse({ status: 401, error: 'Not authenticated' }));
  }

  const cloned = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });

  return next(cloned).pipe(
    catchError((err: HttpErrorResponse) => {
      // Do not redirect to login on server 401: the response can arrive after we've
      // navigated from /auth/callback to /, which would cause an infinite reload loop.
      return throwError(() => err);
    })
  );
};
