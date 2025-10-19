# Controller Endpoint Reference

## AdminController (`/admin`)
| Method | Path | Expects | Description |
| --- | --- | --- | --- |
| POST | `/admin/verify` | JSON body `{ password: string }` | Validates the supplied password against `ADMIN_PASS` and returns `{ valid: true }` on success. |

## AuthorsController (`/authors`)
| Method | Path | Expects | Description |
| --- | --- | --- | --- |
| POST | `/authors` | Header `x-api-password`; JSON body `{ name: string }` | Creates a new author record and returns it. |
| GET | `/authors` | — | Lists all authors. |
| GET | `/authors/:id` | Path param `id` (Mongo ObjectId) | Fetches a single author by database id. |
| PATCH | `/authors/:id` | Header `x-api-password`; path param `id`; JSON body with optional `name` | Updates the specified author. |
| DELETE | `/authors/:id` | Header `x-api-password`; path param `id` | Removes the specified author and responds with a success message. |

## QuotesController (`/quotes`)
| Method | Path | Expects | Description |
| --- | --- | --- | --- |
| POST | `/quotes` | Header `x-api-password`; JSON body `{ author: MongoId, quote: string, description: string }` | Creates a new quote linked to an author. |
| GET | `/quotes` | — | Returns every stored quote. |
| GET | `/quotes/author/:id` | Path param `id` (Mongo ObjectId) | Lists quotes for a specific author. |
| GET | `/quotes/:id` | Path param `id` (Mongo ObjectId) | Retrieves a quote by id. |
| PATCH | `/quotes/:id` | Header `x-api-password`; path param `id`; JSON body with any subset of `author`, `quote`, `description` | Updates the specified quote. |
| DELETE | `/quotes/:id` | Header `x-api-password`; path param `id` | Deletes the specified quote. |

## BackgroundsController (`/backgrounds`)
| Method | Path | Expects | Description |
| --- | --- | --- | --- |
| POST | `/backgrounds` | Header `x-api-password`; multipart form field `image` (<=5 MB) | Uploads a background image and returns its metadata. |
| GET | `/backgrounds` | — | Lists stored background metadata. |
| GET | `/backgrounds/:fileName` | Path param `fileName` | Streams the background file inline, including `Content-Type` and `Content-Length` headers when available. |
| DELETE | `/backgrounds/:fileName` | Header `x-api-password`; path param `fileName` | Deletes the background file and returns a success message. |
