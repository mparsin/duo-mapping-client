# AWS Cognito Setup (Client + API)

This app uses AWS Cognito Hosted UI for sign-in and sends the access token to the API. Environment already has `cognito.authority`, `cognito.clientId`, and `cognito.apiUrl`.

## Hosted UI URLs to configure in Cognito

In the Cognito User Pool → App integration → Hosted UI:

- **Callback URLs**
  - Local: `http://localhost:4200/auth/callback`
  - Prod: `<your CloudFront or S3 app base URL>/auth/callback` (e.g. `https://your-distribution.cloudfront.net/auth/callback`)
- **Sign-out URLs**
  - Local: `http://localhost:4200/`
  - Prod: `<your app base URL>/` (e.g. `https://your-distribution.cloudfront.net/`)

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

Ensure CORS responses from your API include:

- **Access-Control-Allow-Headers**: `Authorization`, `Content-Type` (and any other headers the client sends).
- **Access-Control-Allow-Methods**: the HTTP methods your app uses (e.g. GET, POST, PUT, PATCH, DELETE).
- **Access-Control-Allow-Origin**: your SPA origins (e.g. `http://localhost:4200` for dev, your CloudFront/S3 URL for prod).

The Angular app sends `Authorization: Bearer <access_token>` for requests to `environment.apiUrl` and `environment.cognito.apiUrl`.

## Verification

- **Local**
  - Run `ng serve`, open `http://localhost:4200`. You should be redirected to Cognito Hosted UI to sign in.
  - After signing in, you are redirected to `/auth/callback`, then to `/`. In DevTools → Network, requests to your API should include `Authorization: Bearer ...`.
- **Prod**
  - Deploy the SPA and open the prod URL. Same flow: redirect to Hosted UI, then back to the app.
  - Once the API Gateway JWT authorizer is enabled, requests without a valid token will receive 401.
