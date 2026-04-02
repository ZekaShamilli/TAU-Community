import React, { useEffect, useRef, useState } from 'react';
import { authService } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';

interface GoogleSignInProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}31

declare global {
  interface Window { google: any; }
}

const GoogleSignIn: React.FC<GoogleSignInProps> = ({ onSuccess, onError, disabled }) => {
  const { login } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  const handleCredentialResponse = async (response: any) => {
    try {
      const result = await authService.googleSignIn(response.credential);
      if (result.success && result.data) {
        await login({ user: result.data.user, tokens: result.data.tokens });
        onSuccess?.();
      } else {
        onError?.('Google sign-in failed');
      }
    } catch (error: any) {
      onError?.(error.message || 'Google sign-in failed');
    }
  };

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com') return;

    const render = () => {
      if (!window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: false,
        use_fedcm_for_prompt: true,
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: buttonRef.current.offsetWidth || 480,
        logo_alignment: 'center',
      });
      setLoaded(true);
    };

    if (window.google) { render(); return; }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = render;
    script.onerror = () => onError?.('Failed to load Google services');
    document.head.appendChild(script);

    return () => { if (document.head.contains(script)) document.head.removeChild(script); };
  }, []);

  return (
    <div>
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-dark-600" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-dark-900 text-gray-400">or</span>
        </div>
      </div>

      {/* Google renders its own button here - clicking it opens the OAuth popup */}
      <div
        ref={buttonRef}
        className={`w-full flex justify-center ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
        style={{ minHeight: '44px' }}
      />

      {!loaded && (
        <div className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-500 text-sm">
          Loading Google...
        </div>
      )}
    </div>
  );
};

export default GoogleSignIn;
