import React, { useMemo, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
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

const fadeUp = {
  hidden: { opacity: 0, y: 44, filter: 'blur(4px)' },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.6,
      delay: i * 0.08,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const cardVariant = {
  hidden: { opacity: 0, y: 36, scale: 0.97 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.55,
      delay: i * 0.07,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

const CYCLING_PHRASES = [
  'Student Clubs',
  'Campus Activities',
  'New Friendships',
  'Your Community',
];

const HomePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const { setMode } = useThemeMode();

  const [searchTerm, setSearchTerm] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);

  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, 80]);
  const orb1Y = useTransform(scrollY, [0, 600], [0, -100]);
  const orb2Y = useTransform(scrollY, [0, 600], [0, -60]);
  const orb3Y = useTransform(scrollY, [0, 600], [0, -140]);

  useEffect(() => {
    const id = setInterval(() => {
      setPhraseIndex(p => (p + 1) % CYCLING_PHRASES.length);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  const { data: clubsData, isLoading: clubsLoading, error: clubsError } = useQuery({
    queryKey: ['public-clubs', searchTerm],
    queryFn: () => clubService.getClubs({ search: searchTerm || undefined, status: 'active', page: 1, limit: 12 }),
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
    userApplications.forEach((app: any) => { map.set(app.clubId, app.status); });
    return map;
  }, [userApplications]);

  const handleDashboard = () => {
    if (user?.role === UserRole.SUPER_ADMIN) { navigate('/admin'); return; }
    if (user?.role === UserRole.CLUB_PRESIDENT) { navigate('/club-dashboard'); return; }
    navigate('/dashboard');
  };

  const handleLogout = async () => {
    try { await logout(); navigate('/'); } catch (e) { console.error(e); }
  };

  const handleClubClick = (club: Club) => navigate(`/kulup/${club.urlSlug}`);

  const handleApplyClick = (club: Club, e: React.MouseEvent) => {
    e.stopPropagation();
    const cfg = getClubButtonConfig(club.id, club);
    if (cfg.isPresident) { navigate('/club-dashboard'); return; }
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: `/kulup/${club.urlSlug}` }, message: t('home.applySignInMessage') } });
      return;
    }
    navigate(`/kulup/${club.urlSlug}`);
  };

  const getClubButtonConfig = (clubId: string, club: Club) => {
    if (user && club.president?.id === user.id) {
      return { text: t('club.president'), className: 'flex-1 rounded-xl border border-teal-300 bg-teal-100 px-4 py-2.5 text-sm font-semibold text-teal-800', disabled: false, isPresident: true };
    }
    if (!isAuthenticated) {
      return { text: t('auth.login'), className: 'primary-cta flex-1 px-4 py-2.5 text-sm', disabled: false, isPresident: false };
    }
    const status = applicationStatusMap.get(clubId);
    if (status === 'APPROVED') return { text: t('club.member'), className: 'flex-1 rounded-xl border border-green-300 bg-green-100 px-4 py-2.5 text-sm font-semibold text-green-800 cursor-not-allowed', disabled: true, isPresident: false };
    if (status === 'PENDING')  return { text: t('club.pending'), className: 'flex-1 rounded-xl border border-amber-300 bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-800 cursor-not-allowed', disabled: true, isPresident: false };
    if (status === 'REJECTED') return { text: t('club.rejected'), className: 'flex-1 rounded-xl border border-red-300 bg-red-100 px-4 py-2.5 text-sm font-semibold text-red-700 cursor-not-allowed', disabled: true, isPresident: false };
    return { text: t('club.applyNow'), className: 'primary-cta flex-1 px-4 py-2.5 text-sm', disabled: false, isPresident: false };
  };

  const marqueeItems = [
    '🎓 Academic Clubs', '🎨 Art & Design', '⚽ Sports Teams', '🎵 Music & Culture',
    '💻 Tech & Coding', '🌍 Social Impact', '🔬 Science Society', '📚 Book Club',
    '🎭 Drama & Theatre', '🏋️ Fitness & Wellness', '🌱 Environment', '🎮 Gaming',
  ];

  return (
    <div className="relative min-h-screen overflow-x-clip clean-shell animated-gradient-bg">

      {/* ── Ambient orbs ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          style={{ y: orb1Y }}
          className="absolute -left-40 -top-20 h-[500px] w-[500px] rounded-full opacity-60 animate-pulse-glow"
          style={{ y: orb1Y, background: 'radial-gradient(circle, var(--shape-a), transparent 70%)' }}
        />
        <motion.div
          style={{ y: orb2Y }}
          className="absolute right-[-120px] top-[180px] h-[420px] w-[420px] rounded-full opacity-50"
          style={{ y: orb2Y, background: 'radial-gradient(circle, var(--shape-b), transparent 70%)', animation: 'pulseGlow 5s ease-in-out 1s infinite' }}
        />
        <motion.div
          style={{ y: orb3Y }}
          className="absolute bottom-0 left-1/2 h-[360px] w-[360px] -translate-x-1/2 rounded-full opacity-40"
          style={{ y: orb3Y, background: 'radial-gradient(circle, var(--shape-c), transparent 70%)' }}
        />
      </div>

      {/* ── Nav ── */}
      <header className="soft-topbar">
        <div className="mobile-container flex h-16 items-center justify-between gap-3">
          <button onClick={() => navigate('/')} className="flex items-center gap-2.5 text-left">
            <TauLogo width={38} />
            <div>
              <p className="font-display text-base font-bold text-text-primary leading-tight">TAU Community</p>
              <p className="text-[11px] text-text-tertiary leading-tight">{t('home.clubsAndActivities')}</p>
            </div>
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <LanguageSwitcher />

            {isAuthenticated && user ? (
              <>
                <div className="hidden rounded-full border border-amber-300/60 bg-amber-100/60 px-3 py-1.5 text-xs font-semibold text-amber-700 sm:block">
                  {t('home.coins')}: {userCoins?.balance || 0}
                </div>
                {user.gpa !== undefined && user.gpa !== null && (
                  <div className="hidden rounded-full border border-blue-300/60 bg-blue-100/60 px-3 py-1.5 text-xs font-semibold text-blue-700 sm:block">
                    GPA: {Number(user.gpa).toFixed(2)}
                  </div>
                )}
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(v => !v)}
                    className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-1.5 text-sm font-semibold text-text-primary transition hover:border-[var(--accent)] hover:shadow-md"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}>
                      {user.firstName?.[0]?.toUpperCase()}
                    </span>
                    <span className="hidden sm:inline">{user.firstName}</span>
                  </button>
                  <AnimatePresence>
                    {showUserMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute right-0 top-full mt-2 w-48 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5 shadow-2xl backdrop-blur-xl"
                        style={{ zIndex: 100 }}
                      >
                        <button onClick={handleDashboard} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-text-primary transition hover:bg-[var(--bg-panel)]">
                          {t('home.dashboard')}
                        </button>
                        <button onClick={() => navigate('/gpa-calculator')} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-text-primary transition hover:bg-[var(--bg-panel)]">
                          {t('home.gpaCalculator')}
                        </button>
                        <hr className="my-1 border-[var(--border)]" />
                        <button onClick={handleLogout} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-500 transition hover:bg-red-50/50">
                          {t('auth.logout')}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={() => navigate('/login')} className="secondary-cta px-4 py-2 text-sm">
                  {t('auth.login')}
                </button>
                <button onClick={() => navigate('/signup')} className="primary-cta px-4 py-2 text-sm">
                  {t('auth.signup')} →
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mobile-container pb-20 pt-10">

        {/* ── Hero ── */}
        <motion.section
          style={{ y: heroY }}
          className="relative mx-auto max-w-4xl py-16 text-center sm:py-24"
        >
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="flex flex-col items-center gap-6"
          >
            {/* Badge */}
            <motion.div variants={fadeUp} custom={0}>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-panel)] px-4 py-1.5 text-xs font-semibold text-text-secondary backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                TAU University · Official Platform
              </span>
            </motion.div>

            {/* Headline with cycling phrase */}
            <motion.h1 variants={fadeUp} custom={1}
              className="font-display text-4xl font-bold leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl"
            >
              <span className="text-text-primary">Discover </span>
              <span className="relative inline-block">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={phraseIndex}
                    initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -20, filter: 'blur(6px)' }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="hero-gradient-text inline-block"
                  >
                    {CYCLING_PHRASES[phraseIndex]}
                  </motion.span>
                </AnimatePresence>
              </span>
            </motion.h1>

            {/* Subhead */}
            <motion.p variants={fadeUp} custom={2}
              className="max-w-xl text-base text-text-secondary sm:text-lg leading-relaxed"
            >
              {isAuthenticated && user ? t('home.exploreAuth') : t('home.exploreGuest')}
            </motion.p>

            {/* Search */}
            <motion.div variants={fadeUp} custom={3} className="w-full max-w-xl">
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary text-lg">
                  🔍
                </span>
                <input
                  type="text"
                  placeholder={t('home.searchPlaceholder')}
                  value={searchTerm}
                  onChange={e => {
                    const v = e.target.value;
                    setSearchTerm(v);
                    if (v.toLowerCase() === 'dark mode') { setMode('dark'); setTimeout(() => setSearchTerm(''), 500); }
                    else if (v.toLowerCase() === 'light mode') { setMode('light'); setTimeout(() => setSearchTerm(''), 500); }
                  }}
                  className="soft-input w-full pl-12"
                />
              </div>
            </motion.div>

            {/* CTA buttons (unauthenticated) */}
            {!isAuthenticated && (
              <motion.div variants={fadeUp} custom={4} className="flex flex-wrap items-center justify-center gap-3">
                <button onClick={() => navigate('/signup')} className="primary-cta px-6 py-3 text-base">
                  {t('auth.signup')} →
                </button>
                <button onClick={() => navigate('/login')} className="secondary-cta px-6 py-3 text-base">
                  {t('auth.login')}
                </button>
              </motion.div>
            )}
          </motion.div>
        </motion.section>

        {/* ── Stats ── */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={staggerContainer}
          className="grid gap-4 sm:grid-cols-3"
        >
          {[
            { label: t('home.activeClubs'), value: `${clubs.length}+`, icon: '🏛️' },
            { label: t('home.upcomingActivitiesCount'), value: `${activities.length}+`, icon: '📅' },
            { label: t('home.alwaysOn'), value: '24/7', icon: '⚡' },
          ].map((item, i) => (
            <motion.div key={item.label} variants={fadeUp} custom={i} className="stat-pill group text-center">
              <div className="mb-2 text-2xl">{item.icon}</div>
              <p className="font-display text-4xl font-bold gradient-text-flow">{item.value}</p>
              <p className="mt-1 text-sm text-text-tertiary">{item.label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Marquee strip ── */}
        <div className="relative mt-14 overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-[var(--bg)] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-[var(--bg)] to-transparent" />
          <div className="flex overflow-hidden py-3">
            <div className="marquee-track">
              {[...marqueeItems, ...marqueeItems].map((item, i) => (
                <span key={i} className="mx-4 inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-panel)] px-4 py-2 text-sm font-medium text-text-secondary backdrop-blur-sm whitespace-nowrap">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Upcoming Activities ── */}
        <section className="mt-16">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={fadeUp}
            className="mb-8"
          >
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="section-title">{t('home.upcomingActivities')}</h2>
                <p className="mt-1 text-sm text-text-tertiary">{t('home.dontMiss')}</p>
              </div>
            </div>
          </motion.div>

          {activitiesLoading ? (
            <ActivitySkeleton />
          ) : activities.length === 0 ? (
            <EmptyState message={t('home.noActivities')} />
          ) : (
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.1 }}
              variants={staggerContainer}
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
              {activities.map((activity: any, i) => (
                <motion.article
                  key={activity.id}
                  variants={cardVariant}
                  custom={i}
                  whileHover={{ y: -6 }}
                  onClick={() => activity.club && handleClubClick(activity.club)}
                  className="glow-card cursor-pointer p-5"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                      style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}>
                      {t('home.activityLabel') || 'Activity'}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-semibold text-text-primary leading-snug">{activity.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm text-text-secondary leading-relaxed">{activity.description}</p>
                  <div className="mt-4 space-y-1 border-t border-[var(--border)] pt-4">
                    <p className="text-xs text-text-tertiary">📍 {activity.location || '-'}</p>
                    <p className="text-xs text-text-tertiary">📅 {new Date(activity.startDate).toLocaleDateString()}</p>
                    <p className="text-xs text-text-tertiary">🏛️ {activity.club?.name || '-'}</p>
                  </div>
                </motion.article>
              ))}
            </motion.div>
          )}
        </section>

        {/* ── Student Clubs ── */}
        <section className="mt-16 pb-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={fadeUp}
            className="mb-8"
          >
            <h2 className="section-title">{t('home.studentClubs')}</h2>
            <p className="mt-1 text-sm text-text-tertiary">{t('home.subtitle')}</p>
          </motion.div>

          {clubsError ? (
            <EmptyState message={t('home.failedLoadClubs')} error />
          ) : clubsLoading ? (
            <ClubSkeleton />
          ) : clubs.length === 0 ? (
            <EmptyState message={searchTerm ? t('home.noClubsFound', { query: searchTerm }) : t('home.noClubsAvailable')} />
          ) : (
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.05 }}
              variants={staggerContainer}
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
              {clubs.map((club, i) => {
                const cfg = getClubButtonConfig(club.id, club);
                return (
                  <motion.article
                    key={club.id}
                    variants={cardVariant}
                    custom={i}
                    whileHover={{ y: -6 }}
                    onClick={() => handleClubClick(club)}
                    className="glow-card group cursor-pointer p-5"
                  >
                    {/* Club icon placeholder */}
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl text-lg font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}>
                      {club.name?.[0]?.toUpperCase()}
                    </div>

                    <h3 className="font-display text-xl font-semibold text-text-primary leading-snug">{club.name}</h3>
                    <p className="mt-2 line-clamp-3 text-sm text-text-secondary leading-relaxed">{club.description}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full border border-green-300/60 bg-green-100/60 px-2.5 py-1 text-xs font-semibold text-green-700">
                        {t('club.active')}
                      </span>
                      {club.activitiesCount && club.activitiesCount > 0 && (
                        <span className="rounded-full border border-[var(--border)] bg-[var(--bg-panel)] px-2.5 py-1 text-xs font-semibold text-text-secondary">
                          {club.activitiesCount} {t('club.activities')}
                        </span>
                      )}
                    </div>

                    <div className="mt-5 flex gap-2">
                      <button
                        onClick={e => { e.stopPropagation(); handleClubClick(club); }}
                        className="secondary-cta flex-1 px-4 py-2.5 text-sm"
                      >
                        {t('club.learnMore')}
                      </button>
                      <button
                        onClick={e => handleApplyClick(club, e)}
                        disabled={cfg.disabled}
                        className={cfg.className}
                      >
                        {cfg.text}
                      </button>
                    </div>
                  </motion.article>
                );
              })}
            </motion.div>
          )}
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="mt-8 border-t border-[var(--border)] bg-[var(--bg-elevated)]/60 py-8 backdrop-blur-sm">
        <div className="mobile-container flex flex-col gap-3 text-sm text-text-tertiary sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <TauLogo width={24} />
            <p>{t('home.officialSystem')}</p>
          </div>
          <p>© {new Date().getFullYear()} TAU University</p>
        </div>
      </footer>
    </div>
  );
};

const ActivitySkeleton = () => (
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    {[...Array(3)].map((_, i) => (
      <div key={i} className="glow-card p-5 animate-pulse">
        <div className="h-3 w-16 rounded-full bg-[var(--border)] mb-3" />
        <div className="h-5 w-3/4 rounded-lg bg-[var(--border)] mb-2" />
        <div className="h-3 w-full rounded-lg bg-[var(--border)] mb-1" />
        <div className="h-3 w-2/3 rounded-lg bg-[var(--border)]" />
      </div>
    ))}
  </div>
);

const ClubSkeleton = () => (
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="glow-card p-5 animate-pulse">
        <div className="h-10 w-10 rounded-2xl bg-[var(--border)] mb-4" />
        <div className="h-6 w-2/3 rounded-lg bg-[var(--border)] mb-2" />
        <div className="h-3 w-full rounded-lg bg-[var(--border)] mb-1" />
        <div className="h-3 w-4/5 rounded-lg bg-[var(--border)] mb-1" />
        <div className="h-3 w-3/5 rounded-lg bg-[var(--border)]" />
      </div>
    ))}
  </div>
);

const EmptyState = ({ message, error }: { message: string; error?: boolean }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="glow-card p-12 text-center"
  >
    <div className="mb-3 text-4xl">{error ? '⚠️' : '🔍'}</div>
    <p className="text-text-secondary">{message}</p>
  </motion.div>
);

export default HomePage;
