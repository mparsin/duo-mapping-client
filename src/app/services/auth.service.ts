import { Injectable } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { AuthConfig } from 'angular-oauth2-oidc';
import { firstValueFrom } from 'rxjs';
import { filter, timeout, take } from 'rxjs/operators';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';

function getAuthConfig(): AuthConfig {
  const cognito = environment.cognito;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return {
    issuer: cognito.authority,
    clientId: cognito.clientId,
    redirectUri: `${origin}/auth/callback`,
    postLogoutRedirectUri: origin,
    responseType: 'code',
    scope: 'openid email profile',
    showDebugInformation: !environment.production,
    // Cognito uses different domains for issuer (cognito-idp) vs auth/token endpoints (amazoncognito.com)
    strictDiscoveryDocumentValidation: false,
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private readonly oauthService: OAuthService) {
    this.oauthService.configure(getAuthConfig());
  }

  /** Run at app startup (e.g. from APP_INITIALIZER) to load discovery and process callback if present. */
  init(): Promise<boolean> {
    return this.oauthService.loadDiscoveryDocumentAndTryLogin();
  }

  login(): void {
    this.oauthService.initLoginFlow();
  }

  logout(): void {
    // Cognito /logout expects logout_uri + client_id; angular-oauth2-oidc sends
    // post_logout_redirect_uri + id_token_hint, which can lead to 400 on redirect.
    const baseLogoutUrl = this.oauthService.logoutUrl?.split('?')[0];
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (baseLogoutUrl && origin) {
      const params = new URLSearchParams({
        client_id: environment.cognito.clientId,
        logout_uri: origin,
      });
      this.oauthService.logOut(true); // clear tokens only, no redirect
      window.location.assign(`${baseLogoutUrl}?${params.toString()}`);
    } else {
      this.oauthService.logOut();
    }
  }

  isAuthenticated(): boolean {
    return this.oauthService.hasValidAccessToken();
  }

  getAccessToken(): string | null {
    const token = this.oauthService.getAccessToken();
    return token || null;
  }

  /**
   * Returns the current Cognito user's display name for forms (e.g. author field).
   * Uses ID token claims: name, preferred_username, or cognito:username.
   */
  getCurrentUserName(): string {
    const claims = this.oauthService.getIdentityClaims() as Record<string, unknown> | null;
    if (!claims) return '';
    const name = claims['name'];
    if (typeof name === 'string' && name.trim()) return name.trim();
    const preferred = claims['preferred_username'];
    if (typeof preferred === 'string' && preferred.trim()) return preferred.trim();
    const cognitoUsername = claims['cognito:username'];
    if (typeof cognitoUsername === 'string' && cognitoUsername.trim()) return cognitoUsername.trim();
    return '';
  }

  /**
   * Returns a promise that resolves when the access token is available. After redirect from
   * /auth/callback, we wait for the OAuth library's token_received event (or existing token),
   * then defer one tick so the token is definitely usable by the interceptor.
   */
  whenTokenReady(maxWaitMs = 3000): Promise<void> {
    if (this.oauthService.hasValidAccessToken()) {
      return this.deferOneTick();
    }
    const tokenReceived$ = this.oauthService.events.pipe(
      filter((e) => e.type === 'token_received'),
      take(1),
      timeout({ first: maxWaitMs, with: () => of(null) })
    );
    const eventPromise = firstValueFrom(tokenReceived$);
    const pollPromise = this.pollForToken(maxWaitMs);
    return Promise.race([eventPromise, pollPromise]).then(() => this.deferOneTick());
  }

  private pollForToken(maxWaitMs: number): Promise<void> {
    const start = Date.now();
    return new Promise((resolve) => {
      const check = () => {
        if (this.oauthService.hasValidAccessToken() || Date.now() - start >= maxWaitMs) {
          resolve();
          return;
        }
        setTimeout(check, 50);
      };
      setTimeout(check, 50);
    });
  }

  /** Defer so the token is fully committed before the next HTTP request. */
  private deferOneTick(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  /** Short delay after token is "ready" so backend/network can accept it (reduces 401 on first request). */
  deferAfterTokenReady(ms = 150): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
