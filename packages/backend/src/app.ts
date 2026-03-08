/**
 * Express App Configuration for Testing
 * Exports the Express app without starting the server
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import clubRoutes from './routes/clubs';
import activityRoutes from './routes/activities';
import moderationRoutes from './routes/moderation';
import auditRoutes from './routes/audit';
import cacheRoutes from './routes/cache';
import { createApplicationRoutes } from './routes/applications';
import { prisma } from './lib/database';

// Import error handling
import ErrorHandler from './lib/middleware/error-handler';

const app = express();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.',
      timestamp: new Date().toISOString(),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  credentials: true,
}));
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'TAU Community Backend',
    version: '1.0.0',
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/applications', createApplicationRoutes(prisma));
app.use('/api/moderation', moderationRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/cache', cacheRoutes);

app.get('/api', (req, res) => {
  res.json({
    message: 'TAU Community API Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api',
      auth: '/api/auth',
      users: '/api/users',
      clubs: '/api/clubs',
      activities: '/api/activities',
      applications: '/api/applications',
      moderation: '/api/moderation',
      audit: '/api/audit',
      cache: '/api/cache',
    },
  });
});

// Error handling middleware
app.use(ErrorHandler.handle());

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'The requested endpoint was not found',
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    },
  });
});

export { app };
export default app;