# DaileyQuotes API

A NestJS backend application for managing quotes and authors with MongoDB integration.

## Features

- **Authors Management**: CRUD operations for authors
- **Quotes Management**: CRUD operations for quotes with author references
- **MongoDB Integration**: Uses Mongoose for database operations
- **Data Validation**: Built-in validation using class-validator
- **RESTful API**: Clean REST endpoints for all operations

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (running on localhost:27017)
- npm or yarn

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

## Database Setup

The application is configured to connect to MongoDB Atlas. You need to:

1. **Set up environment variables**: Create a `.env` file in the root directory with:

```
MONGODB_URI=mongodb+srv://avivyona51_db_user:1234@daileyquotes.wxgfos7.mongodb.net/daileyquotes?retryWrites=true&w=majority
PORT=3000
```

2. **The application is already configured** with the correct MongoDB Atlas connection string

3. **Make sure your MongoDB Atlas cluster**:
   - Is running and accessible
   - Has the correct IP whitelist settings
   - Has the database user `avivyona51_db_user` with appropriate permissions

## Running the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run start:prod

# Build the application
npm run build
```

The API will be available at `http://localhost:3000`

## API Endpoints

### Authors

| Method | Endpoint       | Description       |
| ------ | -------------- | ----------------- |
| GET    | `/authors`     | Get all authors   |
| GET    | `/authors/:id` | Get author by ID  |
| POST   | `/authors`     | Create new author |
| PATCH  | `/authors/:id` | Update author     |
| DELETE | `/authors/:id` | Delete author     |

### Quotes

| Method | Endpoint                   | Description                          |
| ------ | -------------------------- | ------------------------------------ |
| GET    | `/quotes`                  | Get all quotes (with author details) |
| GET    | `/quotes?author=:authorId` | Get quotes by author                 |
| GET    | `/quotes/:id`              | Get quote by ID                      |
| POST   | `/quotes`                  | Create new quote                     |
| PATCH  | `/quotes/:id`              | Update quote                         |
| DELETE | `/quotes/:id`              | Delete quote                         |

## Data Models

### Author

```json
{
  "_id": "ObjectId",
  "name": "string",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### Quote

```json
{
  "_id": "ObjectId",
  "author": "ObjectId (reference to Author)",
  "quote": "string",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

## Example Usage

### Create an Author

```bash
curl -X POST http://localhost:3000/authors \
  -H "Content-Type: application/json" \
  -d '{"name": "Albert Einstein"}'
```

### Create a Quote

```bash
curl -X POST http://localhost:3000/quotes \
  -H "Content-Type: application/json" \
  -d '{"author": "AUTHOR_ID", "quote": "Imagination is more important than knowledge."}'
```

### Get All Quotes with Author Details

```bash
curl http://localhost:3000/quotes
```

### Get Quotes by Author

```bash
curl http://localhost:3000/quotes?author=AUTHOR_ID
```

## Project Structure

```
src/
├── authors/           # Author module
│   ├── authors.controller.ts
│   ├── authors.service.ts
│   └── authors.module.ts
├── quotes/            # Quote module
│   ├── quotes.controller.ts
│   ├── quotes.service.ts
│   └── quotes.module.ts
├── schemas/           # MongoDB schemas
│   ├── author.schema.ts
│   └── quote.schema.ts
├── dto/               # Data Transfer Objects
│   ├── create-author.dto.ts
│   ├── update-author.dto.ts
│   ├── create-quote.dto.ts
│   └── update-quote.dto.ts
├── config/            # Configuration
│   └── database.config.ts
├── app.module.ts      # Main application module
└── main.ts           # Application entry point
```

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## License

This project is licensed under the MIT License.
