# AWS Cognito Setup (Client + API)

This app uses AWS Cognito Hosted UI for sign-in and sends the access token to the API. Environment already has `cognito.authority`, `cognito.clientId`, and `cognito.apiUrl`.

## Hosted UI URLs to configure in Cognito

In the Cognito User Pool → App integration → Hosted UI:

- **Callback URLs** (must match exactly; the app uses `origin + '/auth/callback'`)
  - Local: `http://localhost:4200/auth/callback`
  - Prod: `https://<your-domain>/auth/callback` (e.g. `https://duo.piaws.qad.com/auth/callback`)
  - Do **not** use the root URL here — `redirect_mismatch` means the callback URL in the request didn’t match this list.
- **Sign-out URLs** (app uses `origin` with no path)
  - Local: `http://localhost:4200` or `http://localhost:4200/`
  - Prod: `https://<your-domain>` or `https://<your-domain>/` (e.g. `https://duo.piaws.qad.com`)

## SPA routes

All app routes are protected: users must sign in before using the app.

- `''` and `category/:id` use the auth guard; unauthenticated users are redirected to Cognito Hosted UI.

## API protection (API Gateway JWT authorizer)

When you implement the backend, configure API Gateway as follows.

### 1. Create JWT Authorizer

In API Gateway (REST or HTTP API):

- **REST API**: API → Authorizers → Create New Authorizer → Type: JWT.
- **HTTP API**: API → Authorizers → Create and attach to routes.

Use these values (from `environment.cognito`):

- **Issuer**: `environment.cognito.authority`  
  Example: `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_oPCgNjR0o`
- **Audience**: `environment.cognito.clientId`  
  Example: `7889jq6rloftibcqp7jhemj6rn`

### 2. Attach authorizer to routes

Attach the JWT authorizer to every route (or stage) that should require a valid Cognito access token. Leave any public routes (e.g. `/health`) without the authorizer if needed.

### 3. CORS

The browser sends a **preflight** `OPTIONS` request before each API call. If the API does not respond with CORS headers (or returns an error on OPTIONS), you get: *"No 'Access-Control-Allow-Origin' header is present on the requested resource"*.

**Required response headers** (on both OPTIONS and on the actual GET/POST/etc. responses):

| Header | Value (prod example) |
|--------|----------------------|
| `Access-Control-Allow-Origin` | `https://duo.piaws.qad.com` |
| `Access-Control-Allow-Headers` | `Authorization`, `Content-Type` (and any other headers the client sends) |
| `Access-Control-Allow-Methods` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS` |

**AWS API Gateway REST API:**

1. In **API Gateway** → your API (`xwrhlmtfk9`) → **Resources**.
2. Select the resource (e.g. `/api` or `/prod/api`) or the root and enable CORS:
   - **Actions** → **Enable CORS**.
   - **Access-Control-Allow-Origin**: enter `https://duo.piaws.qad.com` (or add multiple origins if you use dev + prod).
   - **Access-Control-Allow-Headers**: e.g. `Authorization,Content-Type`.
   - **Access-Control-Allow-Methods**: e.g. `GET,POST,PUT,PATCH,DELETE,OPTIONS`.
   - Save and **Deploy API** to your stage (e.g. `prod`).
3. If you use a **Lambda proxy** or custom integration, your Lambda/backend must also return these headers on **every** response (including OPTIONS). API Gateway’s “Enable CORS” only adds them for the mock OPTIONS integration; actual method responses need the headers from your integration.
4. For **proxy resources** (`/{proxy+}`), enable CORS on that resource as well so all paths under `/prod/api/...` get the headers.

**Lambda / backend:** If the authorizer or integration returns the response, add to every response:

- `Access-Control-Allow-Origin: https://duo.piaws.qad.com`
- `Access-Control-Allow-Headers: Authorization, Content-Type`
- `Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`

For OPTIONS (preflight), return status 200 with these headers and no body.

The Angular app sends `Authorization: Bearer <access_token>` for requests to `environment.apiUrl` and `environment.cognito.apiUrl`.

## Verification

- **Local**
  - Run `ng serve`, open `http://localhost:4200`. You should be redirected to Cognito Hosted UI to sign in.
  - After signing in, you are redirected to `/auth/callback`, then to `/`. In DevTools → Network, requests to your API should include `Authorization: Bearer ...`.
- **Prod**
  - Deploy the SPA and open the prod URL. Same flow: redirect to Hosted UI, then back to the app.
  - Once the API Gateway JWT authorizer is enabled, requests without a valid token will receive 401.
