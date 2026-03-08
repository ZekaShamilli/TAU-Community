// Route utilities for dynamic club URLs

/**
 * Generate club URL from club slug
 */
export const getClubUrl = (clubSlug: string): string => {
  return `/kulup/${clubSlug}`;
};

/**
 * Extract club slug from URL path
 */
export const extractClubSlug = (pathname: string): string | null => {
  const match = pathname.match(/^\/kulup\/([^\/]+)$/);
  return match ? match[1] : null;
};

/**
 * Validate club slug format
 */
export const isValidClubSlug = (slug: string): boolean => {
  // Club slugs should be alphanumeric with hyphens, no spaces
  return /^[a-z0-9-]+$/.test(slug) && slug.length >= 2 && slug.length <= 100;
};

/**
 * Generate club slug from club name
 */
export const generateClubSlug = (clubName: string): string => {
  return clubName
    .toLowerCase()
    .trim()
    // Replace Turkish characters
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    // Replace spaces and special characters with hyphens
    .replace(/[^a-z0-9]/g, '-')
    // Remove multiple consecutive hyphens
    .replace(/-+/g, '-')
    // Remove leading and trailing hyphens
    .replace(/^-|-$/g, '');
};

/**
 * Route patterns for the application
 */
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  UNAUTHORIZED: '/unauthorized',
  SETUP_2FA: '/setup-2fa',
  ADMIN: '/admin',
  CLUB_DASHBOARD: '/club-dashboard',
  DASHBOARD: '/dashboard',
  CLUB_PAGE: '/kulup/:clubSlug',
  NOT_FOUND: '*',
} as const;

/**
 * Check if current path is a club page
 */
export const isClubPage = (pathname: string): boolean => {
  return pathname.startsWith('/kulup/');
};

/**
 * Get appropriate dashboard URL for user role
 */
export const getDashboardUrl = (userRole: string): string => {
  switch (userRole) {
    case 'SUPER_ADMIN':
      return ROUTES.ADMIN;
    case 'CLUB_PRESIDENT':
      return ROUTES.CLUB_DASHBOARD;
    default:
      return ROUTES.HOME;
  }
};