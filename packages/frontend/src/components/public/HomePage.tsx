import React, { useMemo, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeMode } from '../../contexts/ThemeContext';
import { clubService } from '../../services/clubService';
import { activityService } from '../../services/activityService';
import { applicationService } from '../../services/applicationService';
import { coinService } from '../../services/coinService';
import { Club, UserRole } from '../../types';
import LanguageSwitcher from '../common/LanguageSwitcher';
import ThemeToggle from '../common/ThemeToggle';
import TauLogo from '../../assets/TauLogo.tsx';

const reveal = {
  hidden: { opacity: 0, y: 24 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, delay: index * 0.06, ease: 'easeOut' },
  }),
};

const HomePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const { setMode } = useThemeMode();

  const [searchTerm, setSearchTerm] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 500], [0, 70]);
  const blobY = useTransform(scrollY, [0, 500], [0, -90]);

  const { data: clubsData, isLoading: clubsLoading, error: clubsError } = useQuery({
    queryKey: ['public-clubs', searchTerm],
    queryFn: () =>
      clubService.getClubs({
        search: searchTerm || undefined,
        status: 'active',
        page: 1,
        limit: 12,
      }),
  });

  const { data: upcomingActivities, isLoading: activitiesLoading } = useQuery({
    queryKey: ['upcoming-activities'],
    queryFn: () => activityService.getUpcomingActivities(6),
  });

  const { data: userApplicationsData } = useQuery({
    queryKey: ['user-applications', user?.email],
    queryFn: () => applicationService.getApplications(),
    enabled: !!user && isAuthenticated,
  });

  const { data: userCoins } = useQuery({
    queryKey: ['user-coins', user?.id],
    queryFn: () => (user?.id ? coinService.getUserCoins(user.id) : null),
    enabled: !!user?.id && isAuthenticated,
  });

  const clubs = clubsData?.data || [];
  const activities = Array.isArray(upcomingActivities) ? upcomingActivities : [];
  const userApplications = userApplicationsData?.data || [];

  const applicationStatusMap = useMemo(() => {
    const map = new Map();
    userApplications.forEach((app: any) => {
      map.set(app.clubId, app.status);
    });
    return map;
  }, [userApplications]);

  const handleDashboard = () => {
    if (user?.role === UserRole.SUPER_ADMIN) {
      navigate('/admin');
      return;
    }

    if (user?.role === UserRole.CLUB_PRESIDENT) {
      navigate('/club-dashboard');
      return;
    }

    navigate('/dashboard');
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleClubClick = (club: Club) => {
    navigate(`/kulup/${club.urlSlug}`);
  };

  const handleApplyClick = (club: Club, e: React.MouseEvent) => {
    e.stopPropagation();

    const buttonConfig = getClubButtonConfig(club.id, club);
    if (buttonConfig.isPresident) {
      navigate('/club-dashboard');
      return;
    }

    if (!isAuthenticated) {
      navigate('/login', {
        state: {
          from: { pathname: `/kulup/${club.urlSlug}` },
          message: t('home.applySignInMessage'),
        },
      });
      return;
    }

    navigate(`/kulup/${club.urlSlug}`);
  };

  const getClubButtonConfig = (clubId: string, club: Club) => {
    if (user && club.president?.id === user.id) {
      return {
        text: t('club.president'),
        className:
          'flex-1 rounded-xl border border-teal-300 bg-teal-100 px-4 py-2.5 text-sm font-semibold text-teal-800',
        disabled: false,
        isPresident: true,
      };
    }

    if (!isAuthenticated) {
      return {
        text: t('auth.login'),
        className: 'primary-cta flex-1 px-4 py-2.5 text-sm',
        disabled: false,
        isPresident: false,
      };
    }

    const status = applicationStatusMap.get(clubId);

    if (status === 'APPROVED') {
      return {
        text: t('club.member'),
        className:
          'flex-1 rounded-xl border border-green-300 bg-green-100 px-4 py-2.5 text-sm font-semibold text-green-800 cursor-not-allowed',
        disabled: true,
        isPresident: false,
      };
    }

    if (status === 'PENDING') {
      return {
        text: t('club.pending'),
        className:
          'flex-1 rounded-xl border border-amber-300 bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-800 cursor-not-allowed',
        disabled: true,
        isPresident: false,
      };
    }

    if (status === 'REJECTED') {
      return {
        text: t('club.rejected'),
        className:
          'flex-1 rounded-xl border border-red-300 bg-red-100 px-4 py-2.5 text-sm font-semibold text-red-700 cursor-not-allowed',
        disabled: true,
        isPresident: false,
      };
    }

    return {
      text: t('club.applyNow'),
      className: 'primary-cta flex-1 px-4 py-2.5 text-sm',
      disabled: false,
      isPresident: false,
    };
  };

  return (
    <div className="relative min-h-screen overflow-x-clip clean-shell">
      <div className="pointer-events-none absolute inset-0">
        <motion.div style={{ y: blobY }} className="absolute -left-28 top-16 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl" />
        <motion.div style={{ y: heroY }} className="absolute right-0 top-64 h-80 w-80 rounded-full bg-teal-400/15 blur-3xl" />
        <motion.div style={{ y: blobY }} className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-orange-300/10 blur-3xl" />
      </div>

      <header className="soft-topbar">
        <div className="mobile-container flex h-16 items-center justify-between gap-3">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-left">
            <TauLogo width={40} />
            <div>
              <p className="font-display text-lg font-bold text-text-primary">TAU Community</p>
              <p className="text-xs text-text-tertiary">{t('home.clubsAndActivities')}</p>
            </div>
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <LanguageSwitcher />

            {isAuthenticated && user ? (
              <>
                <div className="hidden rounded-xl border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800 sm:block">
                  {t('home.coins')}: {userCoins?.balance || 0}
                </div>
                
                {user.gpa !== undefined && user.gpa !== null && (
                  <div className="hidden rounded-xl border border-blue-300 bg-blue-100 px-3 py-2 text-xs font-semibold text-blue-800 sm:block">
                    GPA: {user.gpa.toFixed(2)}
                  </div>
                )}

                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu((prev) => !prev)}
                    className="flex items-center gap-2 rounded-xl border border-white/15 bg-dark-800/70 px-3 py-2 text-sm text-text-primary hover:border-red-400/45"
                  >
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-red-400 to-red-600 text-white font-semibold">
                      {user.firstName[0]}
                      {user.lastName[0]}
                    </span>
                    <span className="hidden sm:block">{user.firstName}</span>
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-44 rounded-xl border border-red-300/30 bg-white/95 backdrop-blur-md p-2 shadow-xl shadow-black/20 z-50">
                      <button onClick={handleDashboard} className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors">
                        {t('nav.dashboard')}
                      </button>
                      <button 
                        onClick={() => {
                          navigate('/gpa-calculator');
                          setShowUserMenu(false);
                        }} 
                        className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        {t('gpa.calculator', 'GPA Calculator')}
                      </button>
                      <button onClick={handleLogout} className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-100 transition-colors">
                        {t('auth.logout')}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Desktop buttons */}
                <div className="hidden sm:flex sm:gap-2">
                  <button onClick={() => navigate('/signup')} className="secondary-cta px-4 py-2 text-sm">
                    {t('auth.signup')}
                  </button>
                  <button onClick={() => navigate('/login')} className="primary-cta px-4 py-2 text-sm">
                    {t('auth.login')}
                  </button>
                </div>

                {/* Mobile burger menu */}
                <div className="relative sm:hidden">
                  <button
                    onClick={() => setShowUserMenu((prev) => !prev)}
                    className="flex items-center justify-center w-10 h-10 rounded-lg border border-white/15 bg-dark-800/70 text-text-primary hover:border-red-400/45"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-44 rounded-xl border border-red-300/30 bg-white/95 backdrop-blur-md p-2 shadow-xl shadow-black/20 z-50">
                      <button onClick={() => { navigate('/signup'); setShowUserMenu(false); }} className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors">
                        {t('auth.signup')}
                      </button>
                      <button onClick={() => { navigate('/login'); setShowUserMenu(false); }} className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors">
                        {t('auth.login')}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mobile-container relative z-10 py-10 sm:py-12">
        <section className="max-w-4xl mx-auto">
          <motion.div initial="hidden" animate="visible" variants={reveal} custom={0} style={{ y: heroY }} className="text-center">
            <h1 className="gradient-text-flow font-display text-4xl font-bold leading-tight sm:text-5xl mt-8">
              {isAuthenticated && user ? `${t('home.welcome')}, ${user.firstName}` : t('home.discoverClubs')}
            </h1>
            <p className="mt-4 text-base text-text-secondary sm:text-lg">
              {isAuthenticated && user ? t('home.exploreAuth') : t('home.exploreGuest')}
            </p>

            <div className="mt-7 max-w-2xl mx-auto">
              <label className="mb-2 block text-sm font-medium text-text-secondary">{t('home.findClubsQuickly')}</label>
              <input
                type="text"
                placeholder={t('home.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchTerm(value);
                  
                  // Secret theme toggle commands
                  if (value.toLowerCase() === 'dark mode') {
                    setMode('dark');
                    setTimeout(() => setSearchTerm(''), 500);
                  } else if (value.toLowerCase() === 'light mode') {
                    setMode('light');
                    setTimeout(() => setSearchTerm(''), 500);
                  }
                }}
                className="soft-input w-full"
              />
            </div>
          </motion.div>

          <motion.div initial="hidden" animate="visible" variants={reveal} custom={1} className="grid gap-4 sm:grid-cols-3 mt-10">
            {[
              { label: t('home.activeClubs'), value: `${clubs.length}+` },
              { label: t('home.upcomingActivitiesCount'), value: `${activities.length}+` },
              { label: t('home.alwaysOn'), value: '24/7' },
            ].map((item, idx) => (
              <div key={item.label} className="minimal-panel p-5">
                <p className="text-xs uppercase tracking-wider text-text-tertiary">{item.label}</p>
                <p className="mt-2 font-display text-3xl font-bold text-text-primary">{item.value}</p>
              </div>
            ))}
          </motion.div>
        </section>

        <section className="mt-14">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="section-title">{t('home.upcomingActivities')}</h2>
              <p className="text-sm text-text-tertiary">{t('home.dontMiss')}</p>
            </div>
          </div>

          {activitiesLoading ? (
            <div className="minimal-panel p-10 text-center text-text-secondary">{t('home.loadingActivities')}</div>
          ) : activities.length === 0 ? (
            <div className="minimal-panel p-10 text-center text-text-secondary">{t('home.noActivities')}</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {activities.map((activity: any, index: number) => (
                <motion.article
                  key={activity.id}
                  custom={index}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.2 }}
                  variants={reveal}
                  whileHover={{ y: -4 }}
                  onClick={() => activity.club && handleClubClick(activity.club)}
                  className="minimal-panel lift-card cursor-pointer p-5"
                >
                  <h3 className="font-display text-lg font-semibold text-text-primary">{activity.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm text-text-secondary">{activity.description}</p>
                  <div className="mt-4 space-y-1 text-sm text-text-tertiary">
                    <p>{t('home.clubLabel')}: {activity.club?.name || '-'}</p>
                    <p>{t('home.dateLabel')}: {new Date(activity.startDate).toLocaleDateString()}</p>
                    <p>{t('home.locationLabel')}: {activity.location || '-'}</p>
                  </div>
                </motion.article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-14 pb-12">
          <div className="mb-6">
            <h2 className="section-title">{t('home.studentClubs')}</h2>
            <p className="text-sm text-text-tertiary">{t('home.subtitle')}</p>
          </div>

          {clubsError ? (
            <div className="minimal-panel p-10 text-center text-red-700">{t('home.failedLoadClubs')}</div>
          ) : clubsLoading ? (
            <div className="minimal-panel p-10 text-center text-text-secondary">{t('home.loadingClubs')}</div>
          ) : clubs.length === 0 ? (
            <div className="minimal-panel p-10 text-center text-text-secondary">
              {searchTerm ? t('home.noClubsFound', { query: searchTerm }) : t('home.noClubsAvailable')}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {clubs.map((club, index) => {
                const buttonConfig = getClubButtonConfig(club.id, club);

                return (
                  <motion.article
                    key={club.id}
                    custom={index}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.15 }}
                    variants={reveal}
                    whileHover={{ y: -4 }}
                    onClick={() => handleClubClick(club)}
                    className="minimal-panel lift-card cursor-pointer p-5"
                  >
                    <h3 className="font-display text-xl font-semibold text-text-primary">{club.name}</h3>
                    <p className="mt-2 line-clamp-3 text-sm text-text-secondary">{club.description}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full border border-green-300 bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
                        {t('club.active')}
                      </span>
                      {club.activitiesCount && club.activitiesCount > 0 && (
                        <span className="rounded-full border border-sky-300 bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">
                          {club.activitiesCount} {t('club.activities')}
                        </span>
                      )}
                    </div>

                    <div className="mt-5 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClubClick(club);
                        }}
                        className="secondary-cta flex-1 px-4 py-2.5 text-sm"
                      >
                        {t('club.learnMore')}
                      </button>
                      <button
                        onClick={(e) => handleApplyClick(club, e)}
                        disabled={buttonConfig.disabled}
                        className={buttonConfig.className}
                      >
                        {buttonConfig.text}
                      </button>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-white/10 bg-dark-900/65 py-8">
        <div className="mobile-container flex flex-col gap-3 text-sm text-text-tertiary sm:flex-row sm:items-center sm:justify-between">
          <p>{t('home.officialSystem')}</p>
          <p>{new Date().getFullYear()} TAU University</p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
