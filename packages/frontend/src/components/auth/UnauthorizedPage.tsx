import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Container,
} from '@mui/material';
import {
  Block,
  Home,
  ArrowBack,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

const UnauthorizedPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const handleGoHome = () => {
    if (isAuthenticated && user) {
      switch (user.role) {
        case 'SUPER_ADMIN':
          navigate('/admin');
          break;
        case 'CLUB_PRESIDENT':
          navigate('/club-dashboard');
          break;
        default:
          navigate('/');
          break;
      }
      return;
    }

    navigate('/');
  };

  return (
    <Container maxWidth="md">
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="80vh"
        textAlign="center"
      >
        <Card sx={{ maxWidth: 500, width: '100%' }}>
          <CardContent sx={{ p: 4 }}>
            <Block
              sx={{
                fontSize: 80,
                color: 'error.main',
                mb: 2,
              }}
            />

            <Typography variant="h4" component="h1" gutterBottom>
              {t('errors.accessDenied')}
            </Typography>

            <Typography variant="h6" color="text.secondary" gutterBottom>
              {t('errors.unauthorized')}
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {t('errors.noPermission')}
              {!isAuthenticated && ` ${t('errors.signInAuthorized')}`}
              {isAuthenticated && user && ` ${t('errors.roleNoPermission')}`}
            </Typography>

            {user && (
              <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {t('errors.currentUser')}: <strong>{user.email}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('errors.role')}: <strong>{user.role.replace('_', ' ')}</strong>
                </Typography>
              </Box>
            )}

            <Box display="flex" gap={2} justifyContent="center" flexWrap="wrap">
              <Button
                variant="contained"
                startIcon={<Home />}
                onClick={handleGoHome}
              >
                {t('errors.goHome')}
              </Button>

              <Button
                variant="outlined"
                startIcon={<ArrowBack />}
                onClick={() => navigate(-1)}
              >
                {t('errors.goBack')}
              </Button>

              {!isAuthenticated && (
                <Button
                  variant="outlined"
                  onClick={() => navigate('/login')}
                >
                  {t('common.signIn')}
                </Button>
              )}
            </Box>

            <Box mt={3}>
              <Typography variant="body2" color="text.secondary">
                {t('errors.contactAdmin')}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default UnauthorizedPage;
