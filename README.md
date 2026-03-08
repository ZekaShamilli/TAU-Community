# TAU Community - Club and Activity Management System

TAU Community (Club and Activity Management System) is a modern web application designed to manage student clubs and their activities at TAU university. The system provides hierarchical access control with three distinct user roles: Super Admin, Club President, and Student.

## 🏗️ Architecture

- **Frontend**: React 18 with TypeScript, Material-UI, React Router
- **Backend**: Node.js with Express.js, TypeScript, Prisma ORM
- **Database**: PostgreSQL with Row-Level Security (RLS)
- **Cache**: Redis for session management and caching
- **Authentication**: JWT with refresh tokens, 2FA for Super Admins

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- Docker and Docker Compose
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd tau-kays
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Backend
   cp packages/backend/.env.example packages/backend/.env
   
   # Frontend
   cp packages/frontend/.env.example packages/frontend/.env
   ```

4. **Start the database**
   ```bash
   npm run docker:up
   ```

5. **Run database migrations** (after implementing Prisma schema)
   ```bash
   npm run db:migrate
   ```

6. **Start the development servers**
   ```bash
   npm run dev
   ```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Database Admin (pgAdmin): http://localhost:8080

## 📁 Project Structure

```
tau-kays/
├── packages/
│   ├── backend/                 # Node.js/Express API server
│   │   ├── src/
│   │   │   ├── controllers/     # Route controllers
│   │   │   ├── services/        # Business logic
│   │   │   ├── middleware/      # Express middleware
│   │   │   ├── models/          # Data models
│   │   │   ├── routes/          # API routes
│   │   │   ├── utils/           # Utility functions
│   │   │   ├── test/            # Test setup and utilities
│   │   │   └── index.ts         # Application entry point
│   │   ├── database/            # Database initialization scripts
│   │   ├── prisma/              # Prisma schema and migrations
│   │   └── package.json
│   │
│   └── frontend/                # React application
│       ├── src/
│       │   ├── components/      # Reusable UI components
│       │   ├── pages/           # Page components
│       │   ├── hooks/           # Custom React hooks
│       │   ├── services/        # API service functions
│       │   ├── utils/           # Utility functions
│       │   ├── types/           # TypeScript type definitions
│       │   ├── test/            # Test setup and utilities
│       │   ├── App.tsx          # Main application component
│       │   └── main.tsx         # Application entry point
│       ├── public/              # Static assets
│       └── package.json
│
├── docker-compose.yml           # Docker services configuration
├── .husky/                      # Git hooks
├── .eslintrc.js                 # ESLint configuration
├── .prettierrc                  # Prettier configuration
└── package.json                 # Root package.json with workspaces
```

## 🧪 Testing

The project uses a dual testing approach:

### Unit Tests
```bash
# Run all tests
npm run test

# Run backend tests only
npm run test:backend

# Run frontend tests only
npm run test:frontend

# Run tests in watch mode
npm run test:watch
```

### Property-Based Tests
```bash
# Run property-based tests
npm run test:pbt
```

## 🔧 Development Scripts

```bash
# Development
npm run dev                      # Start both frontend and backend
npm run dev:backend             # Start backend only
npm run dev:frontend            # Start frontend only

# Building
npm run build                   # Build both packages
npm run build:backend           # Build backend only
npm run build:frontend          # Build frontend only

# Code Quality
npm run lint                    # Lint all packages
npm run lint:fix                # Fix linting issues
npm run format                  # Format code with Prettier
npm run format:check            # Check code formatting

# Database
npm run docker:up               # Start database services
npm run docker:down             # Stop database services
npm run db:migrate              # Run database migrations
npm run db:seed                 # Seed database with test data
npm run db:reset                # Reset database
```

## 🔐 User Roles

### Super Admin (Zeka)
- Full system access and control
- Create and manage all clubs
- Content moderation capabilities
- Comprehensive audit log access
- Two-factor authentication required

### Club President (Admin)
- Manage assigned club only
- Create and manage club activities
- Review and process membership applications
- Access club-specific analytics

### Student (Visitor)
- Browse all clubs and activities
- Submit membership applications
- View public club content
- No authentication required for browsing

## 🛡️ Security Features

- **Role-Based Access Control (RBAC)** at database level
- **Row-Level Security (RLS)** policies
- **JWT authentication** with refresh token rotation
- **Two-Factor Authentication** for Super Admins
- **Input validation** and sanitization
- **Rate limiting** on API endpoints
- **Comprehensive audit logging**

## 🌐 API Endpoints

The API follows RESTful conventions:

- `GET /api/health` - Health check
- `POST /api/auth/login` - User authentication
- `GET /api/clubs` - List all clubs
- `POST /api/clubs` - Create new club (Super Admin only)
- `GET /api/clubs/:id/activities` - Get club activities
- `POST /api/applications` - Submit club application

Full API documentation will be available after implementation.

## 🐳 Docker Services

- **PostgreSQL**: Primary database with RBAC
- **Redis**: Caching and session storage
- **pgAdmin**: Database administration interface

## 📊 Monitoring and Logging

- **Winston** for structured logging
- **Comprehensive audit trail** for all user actions
- **Performance monitoring** for database queries
- **Error tracking** and reporting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat(scope): add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Message Format

We use conventional commits:
- `feat(scope): description` - New features
- `fix(scope): description` - Bug fixes
- `docs(scope): description` - Documentation changes
- `style(scope): description` - Code style changes
- `refactor(scope): description` - Code refactoring
- `test(scope): description` - Test additions/changes
- `chore(scope): description` - Maintenance tasks

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏫 About TAU

This system is designed specifically for TAU (Tarsus American University) to enhance student engagement and streamline club management processes.