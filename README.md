# Wedding API

A RESTful API built with Node.js and Fastify to manage wedding invitations and gift registry with payment integration.

## Features

- **Guest Management**
  - RSVP confirmation system
  - Guest list management
  - Attendance tracking

- **Gift Registry**
  - Gift list management
  - Payment integration
  - Gift status tracking

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Fastify
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Payment**: (Integration pending)

## Prerequisites

- Node.js >= 18
- PostgreSQL >= 16
- Docker & Docker Compose (optional)

## Getting Started

1. Clone the repository
```bash
git 
cd wedding-api
```

2. Install dependencies
```bash
npm install
```

3. Start the database (with Docker)
```bash
docker-compose up db -d
```

4. Run migrations
```bash
npm run migrate
```

5. Start the development server
```bash
npm run dev
```

## Database Schema

The project uses Drizzle ORM with PostgreSQL. Main entities include:

- Guests
- Gifts
- Payments
- RSVPs

## Docker Support

The project includes Docker configuration for both development and production environments.

```bash
# Start all services
docker-compose up

# Build and start
docker-compose up --build
```

## License

This project is licensed under the ISC License.