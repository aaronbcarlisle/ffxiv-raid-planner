import { useTranslation } from 'react-i18next';
import { Tooltip } from '../primitives';

export function LanguageToggle() {
  const { i18n } = useTranslation();
  const isJa = i18n.language === 'ja';

  const toggle = () => {
    i18n.changeLanguage(isJa ? 'en' : 'ja');
  };

  return (
    <Tooltip content={isJa ? 'Switch to English' : '日本語に切り替え'}>
      {/* design-system-ignore: Language toggle needs custom sizing */}
      <button
        type="button"
        onClick={toggle}
        aria-label={isJa ? 'Switch to English' : '日本語に切り替え'}
        className="flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-lg text-text-muted hover:text-accent hover:bg-surface-interactive transition-colors flex-shrink-0 text-xs font-bold"
      >
        {isJa ? 'EN' : 'JP'}
      </button>
    </Tooltip>
  );
}
