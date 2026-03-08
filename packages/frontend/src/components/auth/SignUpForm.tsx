import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { authService } from '../../services/authService';
import GoogleSignIn from './GoogleSignIn';
import TauLogo from '../../assets/TauLogo';

interface SignUpFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  confirmPassword: string;
}

const SignUpForm: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<SignUpFormData>({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const password = watch('password');

  const onSubmit = async (data: SignUpFormData) => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      await authService.signUp({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        password: data.password,
      });

      toast.success(t('auth.accountCreatedVerify'));
      navigate('/verify-email', { state: { email: data.email } });
    } catch (err: any) {
      const message = err.response?.data?.error?.message || t('auth.signUpFailed');
      setError(message);
      setIsLoading(false);
    }
  };

  return (
    <div className="clean-shell min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mx-auto w-full max-w-3xl minimal-panel p-6 sm:p-8"
      >
        <div className="mb-7 text-center">
          <div className="flex justify-center mb-3">
            <TauLogo width={120} />
          </div>
          <h1 className="font-display text-4xl font-bold neon-text">TAU Community</h1>
          <h2 className="mt-2 text-2xl font-semibold text-text-primary">{t('auth.createAccount')}</h2>
          <p className="mt-1 text-sm text-text-tertiary">{t('auth.joinStudentCommunity')}</p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-400/35 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Controller
              name="firstName"
              control={control}
              rules={{
                required: t('auth.firstNameRequired'),
                minLength: { value: 2, message: t('auth.firstNameMin') },
              }}
              render={({ field }) => (
                <div>
                  <label className="mb-2 block text-sm text-text-secondary">{t('auth.firstName')}</label>
                  <input {...field} type="text" disabled={isLoading} className="soft-input w-full" placeholder={t('auth.firstName')} />
                  {errors.firstName && <p className="mt-1 text-xs text-red-200">{errors.firstName.message}</p>}
                </div>
              )}
            />

            <Controller
              name="lastName"
              control={control}
              rules={{
                required: t('auth.lastNameRequired'),
                minLength: { value: 2, message: t('auth.lastNameMin') },
              }}
              render={({ field }) => (
                <div>
                  <label className="mb-2 block text-sm text-text-secondary">{t('auth.lastName')}</label>
                  <input {...field} type="text" disabled={isLoading} className="soft-input w-full" placeholder={t('auth.lastName')} />
                  {errors.lastName && <p className="mt-1 text-xs text-red-200">{errors.lastName.message}</p>}
                </div>
              )}
            />
          </div>

          <Controller
            name="email"
            control={control}
            rules={{
              required: t('auth.emailRequired'),
              pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: t('auth.invalidEmail') },
            }}
            render={({ field }) => (
              <div>
                <label className="mb-2 block text-sm text-text-secondary">{t('auth.email')}</label>
                <input {...field} type="email" disabled={isLoading} className="soft-input w-full" placeholder={t('auth.placeholderEmail')} />
                {errors.email && <p className="mt-1 text-xs text-red-200">{errors.email.message}</p>}
              </div>
            )}
          />

          <Controller
            name="phone"
            control={control}
            rules={{
              pattern: { value: /^[\+]?[0-9\s\-\(\)]{10,20}$/, message: t('auth.invalidPhone') },
            }}
            render={({ field }) => (
              <div>
                <label className="mb-2 block text-sm text-text-secondary">{t('auth.phoneOptional')}</label>
                <input {...field} type="tel" disabled={isLoading} className="soft-input w-full" placeholder="+994 50 123 45 67" />
                {errors.phone && <p className="mt-1 text-xs text-red-200">{errors.phone.message}</p>}
              </div>
            )}
          />

          <Controller
            name="password"
            control={control}
            rules={{
              required: t('auth.passwordRequired'),
              minLength: { value: 8, message: t('auth.passwordMinSignup') },
              pattern: { value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, message: t('auth.passwordStrong') },
            }}
            render={({ field }) => (
              <div>
                <label className="mb-2 block text-sm text-text-secondary">{t('auth.password')}</label>
                <div className="relative">
                  <input
                    {...field}
                    type={showPassword ? 'text' : 'password'}
                    disabled={isLoading}
                    className="soft-input w-full pr-14"
                    placeholder={t('auth.placeholderPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs text-text-tertiary hover:bg-white/10"
                  >
                    {showPassword ? t('auth.hide') : t('auth.show')}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-200">{errors.password.message}</p>}
              </div>
            )}
          />

          <Controller
            name="confirmPassword"
            control={control}
            rules={{
              required: t('auth.confirmPasswordRequired'),
              validate: (value) => value === password || t('auth.passwordsNoMatch'),
            }}
            render={({ field }) => (
              <div>
                <label className="mb-2 block text-sm text-text-secondary">{t('auth.confirmPassword')}</label>
                <div className="relative">
                  <input
                    {...field}
                    type={showConfirmPassword ? 'text' : 'password'}
                    disabled={isLoading}
                    className="soft-input w-full pr-14"
                    placeholder={t('auth.placeholderPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs text-text-tertiary hover:bg-white/10"
                  >
                    {showConfirmPassword ? t('auth.hide') : t('auth.show')}
                  </button>
                </div>
                {errors.confirmPassword && <p className="mt-1 text-xs text-red-200">{errors.confirmPassword.message}</p>}
              </div>
            )}
          />

          <motion.button type="submit" disabled={isLoading} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} className="primary-cta mt-2 w-full py-3">
            {isLoading ? t('auth.creatingAccount') : t('auth.createAccount')}
          </motion.button>
        </form>

        <div className="mt-6">
          <GoogleSignIn
            onSuccess={() => {
              toast.success(t('auth.googleSuccess'));
              navigate('/dashboard');
            }}
            onError={(value) => setError(value)}
            disabled={isLoading}
          />
        </div>

        <div className="mt-6 space-y-2 text-center text-sm text-text-tertiary">
          <p>
            {t('auth.alreadyHaveAccount')}{' '}
            <Link to="/login" className="font-semibold text-red-600 hover:text-red-500">{t('auth.signInTitle')}</Link>
          </p>
          <p>
            {t('auth.wantBrowseFirst')}{' '}
            <Link to="/" className="font-semibold text-red-600 hover:text-red-500">{t('auth.backToHome')}</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default SignUpForm;
