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
  Home,
  ArrowBack,
  Search,
} from '@mui/icons-material';

const NotFoundPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

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
            <Typography
              variant="h1"
              component="h1"
              sx={{
                fontSize: '8rem',
                fontWeight: 'bold',
                color: 'primary.main',
                mb: 2,
              }}
            >
              404
            </Typography>

            <Typography variant="h4" component="h2" gutterBottom>
              {t('errors.pageNotFound')}
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              {t('errors.pageNotFoundDesc')}
            </Typography>

            <Box display="flex" gap={2} justifyContent="center" flexWrap="wrap">
              <Button
                variant="contained"
                startIcon={<Home />}
                onClick={() => navigate('/')}
                size="large"
              >
                {t('errors.goHome')}
              </Button>

              <Button
                variant="outlined"
                startIcon={<ArrowBack />}
                onClick={() => navigate(-1)}
                size="large"
              >
                {t('errors.goBack')}
              </Button>
            </Box>

            <Box mt={4}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {t('errors.lookingForSomething')}
              </Typography>
              <Button
                variant="text"
                startIcon={<Search />}
                onClick={() => navigate('/')}
              >
                {t('errors.browseAllClubs')}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default NotFoundPage;
