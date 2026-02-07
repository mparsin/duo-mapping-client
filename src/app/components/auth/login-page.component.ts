import { Component } from '@angular/core';

/**
 * Placeholder for /login route. The App shell shows the signed-out view (title + Sign in button)
 * when the user is not authenticated and not on /auth/callback, so this component does not
 * need to render any content — it just ensures the URL can be /login after Cognito logout redirect.
 */
@Component({
  selector: 'app-login-page',
  standalone: true,
  template: ``,
  styles: [],
})
export class LoginPageComponent {}
