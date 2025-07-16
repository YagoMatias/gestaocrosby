import React from 'react';

export default function LoadingCircle({ size = 32, color = '#000638', className = '' }) {
  return (
    <div className={`flex items-center justify-center ${className}`} role="status" aria-label="Carregando">
      <span
        className="inline-block animate-spin rounded-full border-4 border-solid border-gray-200 border-t-[color:var(--spinner-color)]"
        style={{
          width: size,
          height: size,
          borderTopColor: color,
          borderRightColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: 'transparent',
        }}
      />
      <span className="sr-only">Carregando...</span>
    </div>
  );
} 