import React from 'react';
import tauLogoImg from './Tau-Logo.jpg';

interface TauLogoProps {
  className?: string;
  width?: number;
  height?: number;
}

const TauLogo: React.FC<TauLogoProps> = ({ className = '', width = 200 }) => {
  return (
    <img 
      src={tauLogoImg}
      alt="TAU - Türkiyə-Azərbaycan Universiteti"
      className={className}
      style={{ width, height: 'auto', objectFit: 'contain' }}
    />
  );
};

export default TauLogo;
