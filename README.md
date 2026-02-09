# DuoMappingClient

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.2.2.

The client expects a backend API; all requests use the base URL from `environment.apiUrl`.

## API endpoints

The following endpoints are used by the client. Paths are relative to the API base URL.

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check. Response: `{ status: string }`. |

### Categories

| Method | Path | Description |
|--------|------|-------------|
| GET | `/categories` | Get all categories. |
| GET | `/categories/{category_id}` | Get a single category. |
| GET | `/categories/{category_id}/lines` | Get lines for a category. |
| POST | `/categories/{category_id}/lines` | Create a line. Body: `name`, optional `sub_category_id`, `field_name`, `default`, `reason`, `comment`, `seq_no`, `customer_settings`, `no_of_chars`, `table_id`, `column_id`, `exclude`, `iskeyfield`, `isfkfield`. |
| GET | `/categories/{category_id}/sub-categories` | Get sub-categories for a category. |
| PATCH | `/categories/{category_id}/sub-categories/{sub_category_id}` | Update sub-category. Body: `{ comment: string }`. |
| PATCH | `/categories/{category_id}/sub-categories/{sub_category_id}/exclude` | Exclude sub-category (bulk). |
| PATCH | `/categories/{category_id}/sub-categories/{sub_category_id}/include` | Include sub-category (bulk). |
| PATCH | `/categories/{category_id}/exclude` | Exclude category (bulk). |
| PATCH | `/categories/{category_id}/include` | Include category (bulk). |
| POST | `/categories/{category_id}/config` | Create category config. Body: `{ config }`. |
| PATCH | `/categories/{category_id}/config` | Update category config. Body: `{ config }`. |
| DELETE | `/categories/{category_id}/config` | Delete category config. |

### Lines

| Method | Path | Description |
|--------|------|-------------|
| GET | `/lines/{line_id}` | Get a single line. |
| PATCH | `/lines/{line_id}` | Partial update. Body: any subset of `name`, `field_name`, `default`, `reason`, `comment`, `seq_no`, `customer_settings`, `no_of_chars`, `sub_category_id`, `table_id`, `column_id`, `exclude`, `iskeyfield`, `isfkfield`. |
| PATCH | `/lines/{line_id}/exclude` | Toggle exclude. Body: `{ exclude: boolean }`. |

### Tables and columns

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tables` | Get all tables. |
| GET | `/tables/{table_id}/columns` | Get columns for a table. |
| GET | `/column-comment` | Get column comment. Query: `table_name`, `column_name`. Response: `table_name`, `column_name`, `comment`, optional `table_id`, `column_id`. |

### Search

| Method | Path | Description |
|--------|------|-------------|
| GET | `/search-columns` | Search columns. Query: `columnName`. |
| POST | `/find-table-matches` | Find table matches. Body: `{ column_names: string[] }`. |

### Downloads

| Method | Path | Description |
|--------|------|-------------|
| GET | `/download-schema` | Download generated schema (blob). |
| GET | `/download-upload-config` | Download upload config (blob). |

### GitHub

| Method | Path | Description |
|--------|------|-------------|
| GET | `/github-connection` | Get connection status. Response: `{ configured: boolean }`. |
| PUT | `/github-connection` | Set connection. Body: `{ github_token: string }`. Response: `{ status: 'configured' \| 'removed' }`. |
| DELETE | `/github-connection` | Remove connection. Response: `{ status: 'configured' \| 'removed' }`. |
| POST | `/create-schema-pr` | Create a schema PR. Body: `author` (string), `pr_title` (string), optional `pr_body` (string), optional `auto_merge` (boolean, default false). Response: `pr_url`, `pr_number`, `branch`, `commit_sha`, `file_path`. Owner, repo, file_path, branch_name, base_branch are server-configured. |

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
