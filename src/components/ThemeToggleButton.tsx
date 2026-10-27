import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { AppTheme } from '../lib/themeManager';

interface ThemeToggleButtonProps {
  theme: AppTheme;
  onToggle: () => void;
  compact?: boolean;
}

export const ThemeToggleButton: React.FC<ThemeToggleButtonProps> = ({
  theme,
  onToggle,
  compact = false,
}) => {
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? 'Switch to Light theme' : 'Switch to Dark theme'}
      title={isDark ? 'Switch to Light theme' : 'Switch to Dark theme'}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#CBD5D4] bg-white text-[#111919] hover:bg-[#EEF6F5] transition-colors whitespace-nowrap shrink-0"
    >
      {isDark ? (
        <>
          <Sun className="w-3.5 h-3.5 text-[#F59E0B]" aria-hidden="true" />
          {!compact && <span>Light</span>}
        </>
      ) : (
        <>
          <Moon className="w-3.5 h-3.5 text-[#0B4F4A]" aria-hidden="true" />
          {!compact && <span>Dark</span>}
        </>
      )}
    </button>
  );
};
