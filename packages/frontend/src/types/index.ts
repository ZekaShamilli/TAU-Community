// User types
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  CLUB_PRESIDENT = 'CLUB_PRESIDENT',
  STUDENT = 'STUDENT'
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  totpEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  gpa?: number; // Student GPA (0.00-4.00)
  clubId?: string; // For Club Presidents
  club?: {
    id: string;
    name: string;
  };
  applicationsCount?: number;
  // Additional properties for club members
  membershipStatus?: string;
  joinedAt?: string;
  approvedAt?: string;
  hasAccount?: boolean;
}

// Authentication types
export interface LoginRequest {
  email: string;
  password: string;
  totpCode?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  requiresTwoFactor?: boolean;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// Club types
export interface Club {
  id: string;
  name: string;
  description: string;
  urlSlug: string;
  presidentId?: string;
  president?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    isActive?: boolean;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  activitiesCount?: number;
  applicationsCount?: number;
}

export interface CreateClubRequest {
  name: string;
  description: string;
}

export interface UpdateClubRequest {
  name?: string;
  description?: string;
  presidentEmail?: string;
  presidentFirstName?: string;
  presidentLastName?: string;
  presidentPhone?: string;
}

export interface ClubFilters {
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
  orderBy?: 'name' | 'createdAt' | 'updatedAt';
  orderDirection?: 'asc' | 'desc';
}

// Activity types
export enum ActivityStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED'
}

export interface Activity {
  id: string;
  clubId: string;
  club?: Club;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  maxParticipants?: number;
  createdBy: string;
  createdByUser?: User;
  status: ActivityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateActivityRequest {
  clubId: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  maxParticipants?: number;
}

export interface UpdateActivityRequest {
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  maxParticipants?: number;
  status?: ActivityStatus;
}

export interface ActivityFilters {
  clubId?: string;
  status?: ActivityStatus;
  startDateFrom?: string;
  startDateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
  orderBy?: 'title' | 'startDate' | 'createdAt';
  orderDirection?: 'asc' | 'desc';
}

// Application types
export enum ApplicationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export interface Application {
  id: string;
  clubId: string;
  club?: Club;
  studentId?: string;
  student?: User;
  studentName: string;
  studentEmail: string;
  motivation: string;
  status: ApplicationStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewedByUser?: User;
  reviewComments?: string;
}

export interface CreateApplicationRequest {
  clubId: string;
  studentName: string;
  studentEmail: string;
  motivation: string;
}

export interface UpdateApplicationStatusRequest {
  status: ApplicationStatus;
  reviewComments?: string;
}

export interface ApplicationFilters {
  clubId?: string;
  status?: ApplicationStatus;
  studentEmail?: string;
  page?: number;
  limit?: number;
  orderBy?: 'submittedAt' | 'studentName';
  orderDirection?: 'asc' | 'desc';
}

// Content Moderation types
export interface ContentItem {
  id: string;
  type: 'ACTIVITY' | 'CLUB_INFO' | 'APPLICATION';
  content: any;
  authorId: string;
  author?: User;
  clubId: string;
  club?: Club;
  status: 'PENDING' | 'APPROVED' | 'FLAGGED' | 'REJECTED';
  createdAt: string;
  flaggedAt?: string;
  flagReason?: string;
}

export interface FlagContentRequest {
  contentId: string;
  contentType: string;
  reason: string;
}

export interface ReviewContentRequest {
  action: 'APPROVE' | 'REJECT' | 'EDIT';
  changes?: any;
}

// Audit types
export interface AuditEntry {
  id: string;
  userId: string;
  user?: User;
  userRole: UserRole;
  action: string;
  resource: string;
  resourceId: string;
  changes?: any;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  success: boolean;
  errorMessage?: string;
}

export interface AuditFilters {
  userId?: string;
  userRole?: UserRole;
  action?: string;
  resource?: string;
  dateFrom?: string;
  dateTo?: string;
  success?: boolean;
  page?: number;
  limit?: number;
}

// Form types
export interface FormErrors {
  [key: string]: string | undefined;
}

// UI types
export interface LoadingState {
  [key: string]: boolean;
}

export interface NotificationState {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  id: string;
}

// Route types
export interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  requiredPermissions?: string[];
}

// Dashboard types
export interface DashboardStats {
  totalClubs: number;
  totalActivities: number;
  totalApplications: number;
  totalUsers: number;
  recentActivities: Activity[];
  pendingApplications: Application[];
  flaggedContent: ContentItem[];
}

export interface ClubDashboardStats {
  club: Club;
  totalActivities: number;
  upcomingActivities: number;
  totalApplications: number;
  pendingApplications: number;
  recentApplications: Application[];
  recentActivities: Activity[];
}