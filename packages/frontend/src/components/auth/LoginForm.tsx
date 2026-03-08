import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import GoogleSignIn from './GoogleSignIn';
import TauLogo from '../../assets/TauLogo';

interface LoginFormData {
  email: string;
  password: string;
  totpCode?: string;
}

interface LoginFormProps {
  onSuccess?: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<LoginFormData>({
    defaultValues: {
      email: '',
      password: '',
      totpCode: '',
    },
  });

  const email = watch('email');

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await login({ email: data.email, password: data.password, totpCode: data.totpCode });

      if (result.requiresTwoFactor) {
        setRequiresTwoFactor(true);
        toast.info(t('auth.enterTwoFactor'));
        return;
      }

      toast.success(t('auth.loginSuccess'));
      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || err.message || t('auth.loginFailed');
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleHint = (value: string): { role: string; hint: string } | null => {
    if (value.includes('admin') || value.includes('super')) {
      return { role: t('auth.roleSuperAdmin'), hint: t('auth.roleHintSuperAdmin') };
    }

    if (value.includes('president') || value.includes('club')) {
      return { role: t('auth.roleClubPresident'), hint: t('auth.roleHintClubPresident') };
    }

    return null;
  };

  const roleHint = getRoleHint(email);

  return (
    <div className="aurora-shell min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <motion.section
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45 }}
          className="hidden lg:block"
        >
          <div className="mb-4">
            <TauLogo width={140} />
          </div>
          <p className="mb-3 inline-flex rounded-full border border-red-300/35 bg-red-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-red-600">
            {t('auth.identityTag')}
          </p>
          <h1 className="font-display text-5xl font-bold leading-tight text-text-primary">
            {t('auth.heroTitle')}
          </h1>
          <p className="mt-5 max-w-md text-base text-text-secondary">
            {t('auth.heroSubtitle')}
          </p>
          <div className="mt-8 space-y-3 text-sm text-text-secondary">
            <p className="elevated-panel p-3">{t('auth.secureLogin')}</p>
            <p className="elevated-panel p-3">{t('auth.fastWorkflows')}</p>
            <p className="elevated-panel p-3">{t('auth.twoFactorSupport')}</p>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="elevated-panel w-full p-6 sm:p-8"
        >
          <div className="mb-7">
            <h2 className="font-display text-3xl font-bold text-text-primary">{t('auth.signInTitle')}</h2>
            <p className="mt-1 text-sm text-text-tertiary">{t('auth.signInSubtitle')}</p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-300/40 bg-red-300/10 px-3 py-2 text-sm text-red-100">
              {error}
            </div>
          )}

          {roleHint && (
            <div className="mb-4 rounded-xl border border-sky-300/40 bg-sky-300/10 px-3 py-2 text-sm text-sky-100">
              <span className="font-semibold">{roleHint.role}</span> - {roleHint.hint}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Controller
              name="email"
              control={control}
              rules={{
                required: t('auth.emailRequired'),
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: t('auth.invalidEmail'),
                },
              }}
              render={({ field }) => (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-secondary">{t('auth.email')}</label>
                  <input {...field} type="email" disabled={isLoading} className="soft-input w-full" placeholder={t('auth.placeholderEmail')} />
                  {errors.email && <p className="mt-1 text-xs text-red-200">{errors.email.message}</p>}
                </div>
              )}
            />

            <Controller
              name="password"
              control={control}
              rules={{
                required: t('auth.passwordRequired'),
                minLength: { value: 6, message: t('auth.passwordMin') },
              }}
              render={({ field }) => (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-secondary">{t('auth.password')}</label>
                  <div className="relative">
                    <input
                      {...field}
                      type={showPassword ? 'text' : 'password'}
                      disabled={isLoading}
                      className="soft-input w-full pr-12"
                      placeholder={t('auth.placeholderPassword')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      disabled={isLoading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-text-tertiary hover:bg-white/10 hover:text-text-primary"
                    >
                      {showPassword ? t('auth.hide') : t('auth.show')}
                    </button>
                  </div>
                  {errors.password && <p className="mt-1 text-xs text-red-200">{errors.password.message}</p>}
                </div>
              )}
            />

            {requiresTwoFactor && (
              <Controller
                name="totpCode"
                control={control}
                rules={{
                  required: t('auth.totpRequired'),
                  pattern: { value: /^\d{6}$/, message: t('auth.totpInvalid') },
                }}
                render={({ field }) => (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                    <label className="mb-1.5 block text-sm font-medium text-text-secondary">{t('auth.totpCode')}</label>
                    <input
                      {...field}
                      type="text"
                      maxLength={6}
                      disabled={isLoading}
                      className="soft-input w-full text-center text-2xl tracking-widest"
                      placeholder="000000"
                    />
                    {errors.totpCode && <p className="mt-1 text-xs text-red-200">{errors.totpCode.message}</p>}
                  </motion.div>
                )}
              />
            )}

            <button type="submit" disabled={isLoading} className="primary-cta w-full py-3 text-base disabled:cursor-not-allowed disabled:opacity-60">
              {isLoading ? t('auth.signingIn') : requiresTwoFactor ? t('auth.verifyAndSignIn') : t('auth.signInTitle')}
            </button>
          </form>

          <div className="mt-5">
            <GoogleSignIn
              onSuccess={() => {
                toast.success(t('auth.googleSuccess'));
                if (onSuccess) {
                  onSuccess();
                } else {
                  navigate('/dashboard');
                }
              }}
              onError={(msg) => setError(msg)}
              disabled={isLoading}
            />
          </div>

          <div className="mt-6 space-y-3 text-center text-sm">
            <button onClick={() => navigate('/forgot-password')} disabled={isLoading} className="text-text-tertiary hover:text-text-primary">
              {t('auth.forgotPasswordQuestion')}
            </button>
            <p className="text-text-tertiary">
              {t('auth.noAccount')}{' '}
              <button onClick={() => navigate('/signup')} disabled={isLoading} className="font-semibold text-red-600 hover:text-red-500">
                {t('auth.signup')}
              </button>
            </p>
            <button onClick={() => navigate('/')} disabled={isLoading} className="text-text-tertiary hover:text-text-primary">
              {t('auth.browseAsStudent')}
            </button>
          </div>
        </motion.section>
      </div>
    </div>
  );
};

export default LoginForm;
