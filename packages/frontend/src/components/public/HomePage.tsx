import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { motion, useScroll, useTransform, AnimatePresence, useInView } from 'framer-motion';
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

/* ─── Animation variants ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 40, filter: 'blur(4px)' },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: 0.65, delay: i * 0.09, ease: [0.22, 1, 0.36, 1] },
  }),
};

const fadeIn = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: (i: number = 0) => ({
    opacity: 1, scale: 1,
    transition: { duration: 0.55, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const cardVariant = {
  hidden: { opacity: 0, y: 40, scale: 0.96 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] },
  }),
};


/* ─── Count-up hook ─── */
function useCountUp(end: number, duration = 1800, enabled = true) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!enabled || end === 0) { setValue(end); return; }
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    const raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [end, duration, enabled]);
  return value;
}

/* ─── Stat counter component ─── */
function StatCounter({ value, label, icon, delay = 0 }: { value: number; label: string; icon: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const count = useCountUp(value, 1800, inView);
  return (
    <motion.div
      ref={ref}
      variants={fadeUp}
      custom={delay}
      className="stat-pill group text-center cursor-default"
    >
      <div className="mb-3 text-3xl">{icon}</div>
      <p className="font-display text-4xl font-extrabold hero-gradient-text tabular-nums">
        {count}{value > 0 ? '+' : ''}
      </p>
      <p className="mt-1.5 text-sm text-text-tertiary font-medium">{label}</p>
    </motion.div>
  );
}

/* ─── Activity card ─── */
function ActivityCard({ activity, i, onClick }: { activity: any; i: number; onClick: () => void }) {
  const { t } = useTranslation();
  const dateStr = useMemo(() => {
    try { return new Date(activity.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return '-'; }
  }, [activity.startDate]);

  return (
    <motion.article
      variants={cardVariant}
      custom={i}
      whileHover={{ y: -6, scale: 1.01 }}
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      className="glow-card cursor-pointer p-6 flex flex-col gap-3"
    >
      <div className="flex items-center gap-2.5">
        <span className="rounded-xl px-3 py-1 text-xs font-bold text-white"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}>
          {t('home.activityLabel')}
        </span>
        {activity.club?.name && (
          <span className="text-xs text-text-tertiary font-medium truncate">{activity.club.name}</span>
        )}
      </div>
      <div className="flex-1">
        <h3 className="font-display text-lg font-semibold text-text-primary leading-snug line-clamp-2">{activity.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm text-text-secondary leading-relaxed">{activity.description}</p>
      </div>
      <div className="flex flex-col gap-1.5 border-t border-[var(--border)] pt-4">
        {activity.location && (
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <span>📍</span><span className="truncate">{activity.location}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-text-tertiary">
          <span>📅</span><span>{dateStr}</span>
        </div>
      </div>
    </motion.article>
  );
}

/* ─── Club card ─── */
function ClubCard({ club, i, cfg, onLearnMore, onApply }: {
  club: Club; i: number;
  cfg: { text: string; className: string; disabled: boolean; isPresident: boolean };
  onLearnMore: () => void; onApply: (e: React.MouseEvent) => void;
}) {
  const { t } = useTranslation();
  return (
    <motion.article
      variants={cardVariant}
      custom={i}
      whileHover={{ y: -7 }}
      whileTap={{ scale: 0.985 }}
      onClick={onLearnMore}
      className="club-card-premium group cursor-pointer p-6 flex flex-col gap-4"
    >
      {/* Avatar */}
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 rounded-2xl overflow-hidden flex-shrink-0 shadow-soft">
          {club.logoUrl ? (
            <img src={club.logoUrl} alt={`${club.name} logo`} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xl font-bold text-white"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}>
              {club.name?.[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <h3 className="font-display text-lg font-bold text-text-primary leading-snug truncate">{club.name}</h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-green-300/70 bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">
              {t('club.active')}
            </span>
            {club.activitiesCount != null && club.activitiesCount > 0 && (
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-panel)] px-2.5 py-0.5 text-xs font-semibold text-text-secondary">
                {club.activitiesCount} {t('club.activities')}
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="line-clamp-3 text-sm text-text-secondary leading-relaxed flex-1">{club.description}</p>

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-2 border-t border-[var(--border)]">
        <button
          onClick={e => { e.stopPropagation(); onLearnMore(); }}
          className="secondary-cta flex-1 px-4 py-2.5 text-sm"
        >
          {t('club.learnMore')}
        </button>
        <button
          onClick={onApply}
          disabled={cfg.disabled}
          className={cfg.className}
        >
          {cfg.text}
        </button>
      </div>
    </motion.article>
  );
}

/* ─── Skeletons ─── */
const ClubSkeleton = () => (
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <div className="skeleton h-14 w-14 rounded-2xl" />
          <div className="flex-1 flex flex-col gap-2 pt-1">
            <div className="skeleton h-5 w-3/4 rounded-lg" />
            <div className="skeleton h-3.5 w-1/2 rounded-lg" />
          </div>
        </div>
        <div className="skeleton h-3.5 w-full rounded-lg" />
        <div className="skeleton h-3.5 w-5/6 rounded-lg" />
        <div className="skeleton h-3.5 w-4/6 rounded-lg" />
        <div className="flex gap-2 pt-2">
          <div className="skeleton h-9 flex-1 rounded-xl" />
          <div className="skeleton h-9 flex-1 rounded-xl" />
        </div>
      </div>
    ))}
  </div>
);

const ActivitySkeleton = () => (
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    {[...Array(3)].map((_, i) => (
      <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 flex flex-col gap-3">
        <div className="skeleton h-6 w-24 rounded-xl" />
        <div className="skeleton h-5 w-3/4 rounded-lg" />
        <div className="skeleton h-3.5 w-full rounded-lg" />
        <div className="skeleton h-3.5 w-2/3 rounded-lg" />
        <div className="flex flex-col gap-1.5 pt-3 border-t border-[var(--border)]">
          <div className="skeleton h-3 w-1/2 rounded" />
          <div className="skeleton h-3 w-1/3 rounded" />
        </div>
      </div>
    ))}
  </div>
);

const EmptyState = ({ message, error }: { message: string; error?: boolean }) => (
  <div className={`flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center ${error ? 'border-red-200 bg-red-50/40' : 'border-[var(--border)] bg-[var(--bg-subtle)]'}`}>
    <div className="mb-3 text-4xl">{error ? '⚠️' : '🔍'}</div>
    <p className={`text-sm font-medium ${error ? 'text-red-600' : 'text-text-tertiary'}`}>{message}</p>
  </div>
);


/* ─── Main component ─── */
const HomePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { setMode } = useThemeMode();

  const [searchTerm, setSearchTerm] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);

  const CYCLING_PHRASES = useMemo(() => [
    t('home.phrase1'),
    t('home.phrase2'),
    t('home.phrase3'),
    t('home.phrase4'),
  ], [t]);

  const HOW_STEPS = useMemo(() => [
    { num: '01', icon: '🎓', title: t('home.step1Title'), desc: t('home.step1Desc') },
    { num: '02', icon: '🏛️', title: t('home.step2Title'), desc: t('home.step2Desc') },
    { num: '03', icon: '⚡', title: t('home.step3Title'), desc: t('home.step3Desc') },
  ], [t]);

  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, 70]);
  const orb1Y = useTransform(scrollY, [0, 600], [0, -90]);
  const orb2Y = useTransform(scrollY, [0, 600], [0, -55]);
  const orb3Y = useTransform(scrollY, [0, 600], [0, -130]);

  useEffect(() => {
    const id = setInterval(() => setPhraseIndex(p => (p + 1) % CYCLING_PHRASES.length), 2800);
    return () => clearInterval(id);
  }, []);

  /* Close user menu on outside click */
  useEffect(() => {
    if (!showUserMenu) return;
    const handler = () => setShowUserMenu(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showUserMenu]);

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
    userApplications.forEach((app: any) => map.set(app.clubId, app.status));
    return map;
  }, [userApplications]);

  const handleDashboard = useCallback(() => {
    if (user?.role === UserRole.SUPER_ADMIN) { navigate('/admin'); return; }
    if (user?.role === UserRole.CLUB_PRESIDENT) { navigate('/club-dashboard'); return; }
    navigate('/dashboard');
  }, [user, navigate]);

  const handleLogout = async () => {
    try { await logout(); navigate('/'); } catch (e) { console.error(e); }
  };

  const handleClubClick = useCallback((club: Club) => navigate(`/kulup/${club.urlSlug}`), [navigate]);

  const getClubButtonConfig = useCallback((clubId: string, club: Club) => {
    if (user && club.president?.id === user.id)
      return { text: t('club.president'), className: 'flex-1 rounded-xl border border-teal-300 bg-teal-100 px-4 py-2.5 text-sm font-semibold text-teal-800', disabled: false, isPresident: true };
    if (!isAuthenticated)
      return { text: t('auth.login'), className: 'primary-cta flex-1 px-4 py-2.5 text-sm', disabled: false, isPresident: false };
    const status = applicationStatusMap.get(clubId);
    if (status === 'APPROVED') return { text: t('club.member'), className: 'flex-1 rounded-xl border border-green-300 bg-green-100 px-4 py-2.5 text-sm font-semibold text-green-800 cursor-not-allowed', disabled: true, isPresident: false };
    if (status === 'PENDING')  return { text: t('club.pending'), className: 'flex-1 rounded-xl border border-amber-300 bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-800 cursor-not-allowed', disabled: true, isPresident: false };
    if (status === 'REJECTED') return { text: t('club.rejected'), className: 'flex-1 rounded-xl border border-red-300 bg-red-100 px-4 py-2.5 text-sm font-semibold text-red-700 cursor-not-allowed', disabled: true, isPresident: false };
    return { text: t('club.applyNow'), className: 'primary-cta flex-1 px-4 py-2.5 text-sm', disabled: false, isPresident: false };
  }, [user, isAuthenticated, applicationStatusMap, t]);

  const handleApplyClick = useCallback((club: Club, e: React.MouseEvent) => {
    e.stopPropagation();
    const cfg = getClubButtonConfig(club.id, club);
    if (cfg.isPresident) { navigate('/club-dashboard'); return; }
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: `/kulup/${club.urlSlug}` }, message: t('home.applySignInMessage') } });
      return;
    }
    navigate(`/kulup/${club.urlSlug}`);
  }, [getClubButtonConfig, navigate, isAuthenticated, t]);

  const marqueeItems = useMemo(() => [
    `🎓 ${t('home.marquee1')}`, `🎨 ${t('home.marquee2')}`, `⚽ ${t('home.marquee3')}`, `🎵 ${t('home.marquee4')}`,
    `💻 ${t('home.marquee5')}`, `🌍 ${t('home.marquee6')}`, `🔬 ${t('home.marquee7')}`, `📚 ${t('home.marquee8')}`,
    `🎭 ${t('home.marquee9')}`, `🏋️ ${t('home.marquee10')}`, `🌱 ${t('home.marquee11')}`, `🎮 ${t('home.marquee12')}`,
  ], [t]);

  return (
    <div className="relative min-h-screen overflow-x-clip clean-shell animated-gradient-bg">

      {/* ── Ambient orbs ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <motion.div
          style={{ y: orb1Y, background: 'radial-gradient(circle, var(--shape-a), transparent 70%)' }}
          className="absolute -left-40 -top-20 h-[600px] w-[600px] rounded-full opacity-70 animate-pulse-glow"
        />
        <motion.div
          style={{ y: orb2Y, background: 'radial-gradient(circle, var(--shape-b), transparent 70%)' }}
          className="absolute right-[-120px] top-[200px] h-[480px] w-[480px] rounded-full opacity-55"
        />
        <motion.div
          style={{ y: orb3Y, background: 'radial-gradient(circle, var(--shape-c), transparent 70%)' }}
          className="absolute bottom-0 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full opacity-45"
        />
      </div>

      {/* ── Nav ── */}
      <header className="soft-topbar">
        <div className="mobile-container flex h-16 items-center justify-between gap-3">
          <motion.button
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 text-left"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            <TauLogo width={36} />
            <div>
              <p className="font-display text-base font-bold text-text-primary leading-tight">TAU Community</p>
              <p className="text-[10px] text-text-tertiary leading-tight tracking-wide">{t('home.clubsAndActivities')}</p>
            </div>
          </motion.button>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <LanguageSwitcher />

            {isAuthenticated && user ? (
              <>
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="hidden rounded-full border border-amber-300/60 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 sm:flex items-center gap-1"
                >
                  <span>🪙</span>
                  <span>{userCoins?.balance || 0}</span>
                </motion.div>
                {user.gpa !== undefined && user.gpa !== null && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="hidden rounded-full border border-blue-300/60 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 sm:flex items-center gap-1"
                  >
                    <span>📊</span>
                    <span>GPA {Number(user.gpa).toFixed(2)}</span>
                  </motion.div>
                )}
                <div className="relative" onClick={e => e.stopPropagation()}>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setShowUserMenu(v => !v)}
                    className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-1.5 text-sm font-semibold text-text-primary transition hover:border-[var(--accent)] hover:shadow-soft"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}>
                      {user.firstName?.[0]?.toUpperCase()}
                    </span>
                    <span className="hidden sm:inline">{user.firstName}</span>
                  </motion.button>
                  <AnimatePresence>
                    {showUserMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.94 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.94 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5 shadow-float"
                        style={{ zIndex: 100 }}
                      >
                        <div className="px-3 py-2 mb-1 border-b border-[var(--border)]">
                          <p className="text-xs font-semibold text-text-primary truncate">{user.firstName} {user.lastName}</p>
                          <p className="text-xs text-text-tertiary truncate">{user.email}</p>
                        </div>
                        <button onClick={handleDashboard} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-text-primary transition hover:bg-[var(--bg-subtle)] flex items-center gap-2">
                          <span>🏠</span><span>{t('home.dashboard')}</span>
                        </button>
                        <button onClick={() => navigate('/gpa-calculator')} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-text-primary transition hover:bg-[var(--bg-subtle)] flex items-center gap-2">
                          <span>🎓</span><span>{t('home.gpaCalculator')}</span>
                        </button>
                        <div className="my-1 h-px bg-[var(--border)]" />
                        <button onClick={handleLogout} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-500 transition hover:bg-red-50 flex items-center gap-2">
                          <span>👋</span>{t('auth.logout')}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2"
              >
                <button onClick={() => navigate('/login')} className="secondary-cta px-4 py-2 text-sm">
                  {t('auth.login')}
                </button>
                <button onClick={() => navigate('/signup')} className="primary-cta px-4 py-2 text-sm">
                  {t('auth.signup')} →
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </header>

      <main className="mobile-container pb-28 pt-10">

        {/* ── Hero ── */}
        <motion.section
          style={{ y: heroY }}
          className="relative mx-auto max-w-4xl py-16 text-center sm:py-24"
        >
          {/* Dot grid */}
          <div className="dot-grid-bg pointer-events-none absolute inset-0 rounded-3xl" aria-hidden />

          {/* Floating badges */}
          <motion.div
            animate={{ y: [0, -10, 0], rotate: [-2, 1, -2] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            className="floating-badge absolute -left-4 top-16 hidden xl:flex text-text-primary"
          >
            <span className="text-base">🏛️</span>
            <span className="text-xs">{clubs.length > 0 ? `${clubs.length}+ ${t('home.floatingBadgeClubs')}` : t('home.floatingBadgeClubs')}</span>
          </motion.div>

          <motion.div
            animate={{ y: [0, -14, 0], rotate: [2, -1, 2] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            className="floating-badge absolute -right-4 top-28 hidden xl:flex text-text-primary"
          >
            <span className="text-base">⚡</span>
            <span className="text-xs">{t('home.floatingBadgePlatform')}</span>
          </motion.div>

          <motion.div
            animate={{ y: [0, -8, 0], rotate: [-1, 2, -1] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
            className="floating-badge absolute -left-8 bottom-20 hidden xl:flex text-text-primary"
          >
            <span className="text-base">🎓</span>
            <span className="text-xs">TAU University</span>
          </motion.div>

          <motion.div
            animate={{ y: [0, -12, 0], rotate: [1, -2, 1] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
            className="floating-badge absolute -right-6 bottom-24 hidden xl:flex text-text-primary"
          >
            <span className="text-base">🪙</span>
            <span className="text-xs">{t('home.floatingBadgeRewards')}</span>
          </motion.div>

          {/* Content */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="relative flex flex-col items-center gap-6 z-10"
          >
            {/* Eyebrow badge */}
            <motion.div variants={fadeUp} custom={0}>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)]/90 px-4 py-1.5 text-xs font-semibold text-text-secondary backdrop-blur-sm shadow-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                TAU University
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={fadeUp}
              custom={1}
              className="font-display text-4xl font-extrabold leading-[1.08] tracking-[-0.045em] sm:text-5xl lg:text-6xl xl:text-7xl"
            >
              <span className="text-text-primary">{t('home.discover')} </span>
              <span className="relative inline-block">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={phraseIndex}
                    initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -20, filter: 'blur(6px)' }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="hero-gradient-text inline-block"
                  >
                    {CYCLING_PHRASES[phraseIndex]}
                  </motion.span>
                </AnimatePresence>
              </span>
            </motion.h1>

            {/* Subheading */}
            <motion.p
              variants={fadeUp}
              custom={2}
              className="max-w-lg text-base text-text-secondary sm:text-lg leading-relaxed"
            >
              {isAuthenticated && user
                ? t('home.exploreAuth')
                : t('home.exploreGuest')}
            </motion.p>

            {/* Search */}
            <motion.div variants={fadeUp} custom={3} className="w-full max-w-lg">
              <div className="relative group">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary text-lg transition-colors group-focus-within:text-accent">
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
                  className="soft-input w-full pl-12 pr-4"
                />
              </div>
            </motion.div>

            {/* CTA buttons */}
            {!isAuthenticated && (
              <motion.div variants={fadeUp} custom={4} className="flex flex-wrap items-center justify-center gap-3">
                <button onClick={() => navigate('/signup')} className="hero-cta-primary">
                  {t('auth.signup')} →
                </button>
                <button onClick={() => navigate('/login')} className="hero-cta-secondary">
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
          <StatCounter value={clubs.length} label={t('home.activeClubs')} icon="🏛️" delay={0} />
          <StatCounter value={activities.length} label={t('home.upcomingActivitiesCount')} icon="📅" delay={1} />
          <StatCounter value={0} label={t('home.alwaysOn')} icon="⚡" delay={2} />
        </motion.div>

        {/* ── Marquee ── */}
        <div className="relative mt-16 overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[var(--bg)] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[var(--bg)] to-transparent" />
          <div className="flex overflow-hidden py-3">
            <div className="marquee-track">
              {[...marqueeItems, ...marqueeItems].map((item, i) => (
                <span key={i} className="mx-3 inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-text-secondary shadow-xs whitespace-nowrap">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── How It Works ── */}
        {!isAuthenticated && !isLoading && <section className="mt-24">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer}
            className="mb-12 text-center"
          >
            <motion.div variants={fadeUp} custom={0} className="flex justify-center mb-4">
              <span className="section-eyebrow">{t('home.howItWorks')}</span>
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="section-title">
              {t('home.howItWorksTitle')}
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="mt-3 text-text-secondary max-w-md mx-auto">
              {t('home.howItWorksDesc')}
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
            className="grid gap-6 md:grid-cols-3 relative"
          >
            {/* Connector line (desktop only) */}
            <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-px bg-gradient-to-r from-transparent via-[var(--border-strong)] to-transparent pointer-events-none" aria-hidden />

            {HOW_STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                variants={cardVariant}
                custom={i}
                className="feature-step-card p-8 text-center cursor-default"
              >
                <div className="flex justify-center mb-5">
                  <div className="relative">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
                      style={{ background: 'linear-gradient(135deg, var(--accent-muted), color-mix(in srgb, var(--accent-muted) 60%, transparent))' }}>
                      {step.icon}
                    </div>
                    <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-white text-[10px] font-bold shadow-red-glow">
                      {step.num.replace('0', '')}
                    </span>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-text-primary mb-2 tracking-tight">{step.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>}

        {/* ── Upcoming Activities ── */}
        <section className="mt-24">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
            className="mb-10"
          >
            <motion.div variants={fadeUp} custom={0} className="flex justify-start mb-3">
              <span className="section-eyebrow">📅 {t('home.eventsLabel')}</span>
            </motion.div>
            <motion.div variants={fadeUp} custom={1} className="flex items-end justify-between gap-4">
              <div>
                <h2 className="section-title">{t('home.upcomingActivities')}</h2>
                <p className="mt-1.5 text-sm text-text-tertiary">{t('home.dontMiss')}</p>
              </div>
            </motion.div>
          </motion.div>

          {activitiesLoading ? (
            <ActivitySkeleton />
          ) : activities.length === 0 ? (
            <EmptyState message={t('home.noActivities')} />
          ) : (
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.05 }}
              variants={staggerContainer}
              className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
            >
              {activities.map((activity: any, i: number) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  i={i}
                  onClick={() => activity.club && handleClubClick(activity.club)}
                />
              ))}
            </motion.div>
          )}
        </section>

        {/* ── Student Clubs ── */}
        <section className="mt-24">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
            className="mb-10"
          >
            <motion.div variants={fadeUp} custom={0} className="flex justify-start mb-3">
              <span className="section-eyebrow">🏛️ {t('home.clubsLabel')}</span>
            </motion.div>
            <motion.div variants={fadeUp} custom={1}>
              <h2 className="section-title">{t('home.studentClubs')}</h2>
              <p className="mt-1.5 text-sm text-text-tertiary">{t('home.subtitle')}</p>
            </motion.div>
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
              className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
            >
              {clubs.map((club, i) => {
                const cfg = getClubButtonConfig(club.id, club);
                return (
                  <ClubCard
                    key={club.id}
                    club={club}
                    i={i}
                    cfg={cfg}
                    onLearnMore={() => handleClubClick(club)}
                    onApply={e => handleApplyClick(club, e)}
                  />
                );
              })}
            </motion.div>
          )}
        </section>

        {/* ── CTA Banner ── */}
        {!isAuthenticated && (
          <motion.section
            initial={{ opacity: 0, y: 48 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mt-24"
          >
            <div className="cta-banner rounded-3xl px-8 py-16 text-center text-white relative overflow-hidden">
              <div className="relative z-10 flex flex-col items-center gap-6">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                  className="text-5xl mb-2"
                >
                  🚀
                </motion.div>
                <div>
                  <h2 className="text-3xl sm:text-4xl font-extrabold tracking-[-0.04em] text-white">
                    {t('home.ctaTitle')}
                  </h2>
                  <p className="mt-3 text-base text-red-100 max-w-md mx-auto leading-relaxed">
                    {t('home.ctaDesc')}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate('/signup')}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-base font-bold text-[var(--accent)] shadow-lg transition hover:shadow-xl"
                  >
                    {t('home.ctaButton')}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate('/signup')}
                    className="inline-flex items-center gap-2 rounded-2xl border-2 border-white/30 bg-white/10 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                  >
                    {t('home.ctaSecondary')}
                  </motion.button>
                </div>

                {/* Trust indicators */}
                <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 mt-2 text-sm text-red-100 font-medium">
                  <span className="flex items-center gap-1.5">✅ {t('home.trustFree')}</span>
                  <span className="flex items-center gap-1.5">✅ {t('home.trustNoSpam')}</span>
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--border)] bg-[var(--bg-panel)] py-8 mt-8">
        <div className="mobile-container flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2.5">
            <TauLogo width={28} />
            <span className="text-sm font-semibold text-text-primary">TAU Community</span>
            <span className="text-text-tertiary text-sm">·</span>
            <span className="text-xs text-text-tertiary">{t('home.footerTagline')}</span>
          </div>
          <p className="text-xs text-text-tertiary text-center sm:text-right">
            © {new Date().getFullYear()} TAU University. {t('home.allRightsReserved')}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
