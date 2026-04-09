import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { clubService } from '../../services/clubService';
import { applicationService } from '../../services/applicationService';
import { Club } from '../../types';
import TauLogo from '../../assets/TauLogo.tsx';
import LanguageSwitcher from '../common/LanguageSwitcher';
import ThemeToggle from '../common/ThemeToggle';
import { toast } from 'react-toastify';

const fadeUp = {
  hidden: { opacity: 0, y: 32, filter: 'blur(4px)' },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: 0.55, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] },
  }),
};

const cardVariant = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] },
  }),
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

/* ─── Club Card ─── */
function ClubCard({
  club, i, onView, onApply, applyText, applyDisabled,
}: {
  club: Club; i: number;
  onView: () => void;
  onApply: (e: React.MouseEvent) => void;
  applyText: string;
  applyDisabled: boolean;
}) {
  const { t } = useTranslation();
  return (
    <motion.article
      variants={cardVariant}
      custom={i}
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.985 }}
      onClick={onView}
      className="club-card-premium group cursor-pointer p-6 flex flex-col gap-4"
    >
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 rounded-2xl overflow-hidden flex-shrink-0 shadow-soft">
          {club.logoUrl ? (
            <img src={club.logoUrl} alt={club.name} className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-xl font-bold text-white"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
            >
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

      <div className="flex gap-2 mt-auto pt-2 border-t border-[var(--border)]">
        <button
          onClick={e => { e.stopPropagation(); onView(); }}
          className="secondary-cta flex-1 px-4 py-2.5 text-sm"
        >
          {t('club.learnMore')}
        </button>
        <button
          onClick={onApply}
          disabled={applyDisabled}
          className={`primary-cta flex-1 px-4 py-2.5 text-sm ${applyDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {applyText}
        </button>
      </div>
    </motion.article>
  );
}

/* ─── Skeleton ─── */
const ClubSkeleton = () => (
  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
    {[...Array(9)].map((_, i) => (
      <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 flex flex-col gap-4 animate-pulse">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-2xl bg-[var(--bg-subtle)]" />
          <div className="flex-1 pt-1 space-y-2">
            <div className="h-4 w-3/4 rounded bg-[var(--bg-subtle)]" />
            <div className="h-3 w-1/3 rounded bg-[var(--bg-subtle)]" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-[var(--bg-subtle)]" />
          <div className="h-3 w-5/6 rounded bg-[var(--bg-subtle)]" />
          <div className="h-3 w-2/3 rounded bg-[var(--bg-subtle)]" />
        </div>
        <div className="flex gap-2 pt-2 border-t border-[var(--border)]">
          <div className="h-9 flex-1 rounded-xl bg-[var(--bg-subtle)]" />
          <div className="h-9 flex-1 rounded-xl bg-[var(--bg-subtle)]" />
        </div>
      </div>
    ))}
  </div>
);

/* ─── Main Page ─── */
const ClubsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active'>('active');

  const { data: clubsData, isLoading, error } = useQuery({
    queryKey: ['clubs-page', filterActive],
    queryFn: () => clubService.getClubs({ isActive: filterActive === 'active' ? true : undefined, limit: 100 } as any),
  });

  const { data: myApplications } = useQuery({
    queryKey: ['my-applications'],
    queryFn: () => applicationService.getApplications(),
    enabled: isAuthenticated,
  });

  const allClubs: Club[] = useMemo(() => {
    const list = clubsData?.data ?? [];
    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase();
    return list.filter(c => c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q));
  }, [clubsData, searchTerm]);

  const appliedClubIds = useMemo(() => {
    if (!myApplications) return new Set<string>();
    return new Set(((myApplications as unknown as any[]) ?? []).map((a: any) => a.clubId ?? a.club?.id).filter(Boolean));
  }, [myApplications]);

  const getApplyConfig = useCallback((club: Club) => {
    if (!isAuthenticated) return { text: t('club.giriş'), disabled: false };
    if (user?.clubId === club.id) return { text: t('club.member'), disabled: true };
    if (appliedClubIds.has(club.id)) return { text: t('club.applied'), disabled: true };
    return { text: t('club.apply'), disabled: false };
  }, [isAuthenticated, user, appliedClubIds, t]);

  const handleView = useCallback((club: Club) => navigate(`/kulup/${club.urlSlug}`), [navigate]);

  const handleApply = useCallback((club: Club, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) { navigate('/signup'); return; }
    navigate(`/kulup/${club.urlSlug}`);
  }, [isAuthenticated, navigate]);

  const handleDashboard = () => {
    if (!user) return;
    if (user.role === 'SUPER_ADMIN') navigate('/admin');
    else if (user.role === 'CLUB_PRESIDENT') navigate('/club-dashboard');
    else navigate('/');
  };

  const handleLogout = async () => {
    try { await logout(); navigate('/'); } catch { toast.error(t('auth.logoutFailed')); }
  };

  return (
    <div className="min-h-screen animated-gradient-bg" onClick={() => setShowUserMenu(false)}>
      {/* ── Navbar ── */}
      <header className="soft-topbar">
        <div className="mobile-container flex h-16 items-center justify-between gap-3">
          <motion.button
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 text-left"
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
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
              <div className="relative" onClick={e => e.stopPropagation()}>
                <motion.button
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                  onClick={() => setShowUserMenu(v => !v)}
                  className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-1.5 text-sm font-semibold text-text-primary transition hover:border-[var(--accent)] hover:shadow-soft"
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
                  >
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
                      <button onClick={() => navigate('/settings')} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-text-primary transition hover:bg-[var(--bg-subtle)] flex items-center gap-2">
                        <span>⚙️</span><span>Tənzimləmələr</span>
                      </button>
                      <div className="my-1 h-px bg-[var(--border)]" />
                      <button onClick={handleLogout} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-500 transition hover:bg-red-50 flex items-center gap-2">
                        <span>👋</span>{t('auth.logout')}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={() => navigate('/login')}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-4 py-2 text-sm font-semibold text-text-primary transition hover:border-[var(--accent)]"
                >
                  {t('auth.login')}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={() => navigate('/signup')}
                  className="primary-cta px-4 py-2 text-sm"
                >
                  {t('auth.signup')} →
                </motion.button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mobile-container pt-10 pb-24">
        {/* ── Page Header ── */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="mb-10"
        >
          <motion.div variants={fadeUp} custom={0} className="flex justify-start mb-3">
            <span className="section-eyebrow">🏛️ {t('home.clubsLabel')}</span>
          </motion.div>
          <motion.h1
            variants={fadeUp}
            custom={1}
            className="section-title"
          >
            {t('home.studentClubs')}
          </motion.h1>
          <motion.p
            variants={fadeUp}
            custom={2}
            className="mt-1.5 text-sm text-text-tertiary max-w-xl"
          >
            {t('home.subtitle')}
          </motion.p>
        </motion.div>

        {/* ── Search + Filter ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col sm:flex-row gap-3 mb-8"
        >
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={t('home.searchPlaceholder')}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] pl-10 pr-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 transition"
            />
          </div>
          <div className="flex rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-1 gap-1 self-start">
            {(['active', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterActive(f)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                  filterActive === f
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'text-text-secondary hover:text-text-primary hover:bg-[var(--bg-subtle)]'
                }`}
              >
                {f === 'active' ? t('common.filterActive') : t('common.filterAll')}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Club Grid ── */}
        {isLoading ? (
          <ClubSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="text-4xl">⚠️</div>
            <p className="text-text-secondary font-medium">{t('home.failedLoadClubs')}</p>
          </div>
        ) : allClubs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 gap-4 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-[var(--bg-subtle)] flex items-center justify-center text-3xl mb-1">🏛️</div>
            <p className="text-text-primary font-semibold text-lg">
              {searchTerm ? t('home.noClubsFound', { query: searchTerm }) : t('home.noClubsAvailable')}
            </p>
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-sm text-[var(--accent)] font-medium hover:underline">
                {t('common.clearSearch')}
              </button>
            )}
          </motion.div>
        ) : (
          <>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-xs text-text-tertiary font-medium mb-4"
            >
              {allClubs.length} {t('home.activeClubs').toLowerCase()}
            </motion.p>
            <motion.div
              initial="hidden"
              animate="visible"
              variants={stagger}
              className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
            >
              {allClubs.map((club, i) => {
                const cfg = getApplyConfig(club);
                return (
                  <ClubCard
                    key={club.id}
                    club={club}
                    i={i}
                    onView={() => handleView(club)}
                    onApply={e => handleApply(club, e)}
                    applyText={cfg.text}
                    applyDisabled={cfg.disabled}
                  />
                );
              })}
            </motion.div>
          </>
        )}

        {/* ── CTA ── */}
        {!isAuthenticated && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mt-20"
          >
            <div className="cta-banner rounded-3xl text-white relative overflow-hidden">
              <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full border border-white/10" />
              <div className="absolute -top-10 -right-10 w-52 h-52 rounded-full border border-white/10" />
              <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full border border-white/10" />
              <div className="absolute -bottom-12 -left-12 w-56 h-56 rounded-full border border-white/10" />
              <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-10 px-10 py-14">
                <div className="flex flex-col items-center lg:items-start text-center lg:text-left gap-5 max-w-lg">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-white/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse" />
                    TAU Community
                  </span>
                  <h2 className="text-3xl sm:text-4xl font-extrabold tracking-[-0.04em] text-white leading-tight">{t('home.ctaTitle')}</h2>
                  <p className="text-base text-white/70 leading-relaxed">{t('home.ctaDesc')}</p>
                  <div className="flex flex-wrap gap-3 text-sm text-white font-medium">
                    {[t('home.trustFree'), t('home.trustNoSpam')].map(label => (
                      <span key={label} className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-white" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
                  <motion.button whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }} onClick={() => navigate('/signup')}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-8 py-4 text-base font-bold text-[var(--accent)] shadow-lg hover:shadow-xl whitespace-nowrap">
                    {t('home.ctaButton')}
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }} onClick={() => navigate('/login')}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm hover:bg-white/20 whitespace-nowrap">
                    {t('auth.login')}
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--border)] bg-[var(--bg-panel)] py-8">
        <div className="mobile-container flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2.5">
            <TauLogo width={28} />
            <div>
              <p className="text-sm font-bold text-text-primary">TAU Community</p>
              <p className="text-xs text-text-tertiary">{t('home.footerTagline')}</p>
            </div>
          </div>
          <p className="text-xs text-text-tertiary">© {new Date().getFullYear()} TAU Community</p>
        </div>
      </footer>
    </div>
  );
};

export default ClubsPage;
