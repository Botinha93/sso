import { Languages } from 'lucide-react'
import { useI18n } from '../i18n'

interface Props {
  className?: string
}

export default function LanguageSelector({ className }: Props) {
  const { language, setLanguage, languages, t } = useI18n()

  return (
    <label className={`inline-flex items-center gap-2 text-xs text-slate-500 ${className ?? ''}`}>
      <Languages size={14} aria-hidden />
      <span className="sr-only">{t('common.language')}</span>
      <select
        className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-slate-400 focus-visible:ring-sky-500/40"
        value={language}
        onChange={(event) => setLanguage(event.target.value as typeof language)}
        aria-label={t('common.language')}
      >
        {languages.map((option) => (
          <option key={option.code} value={option.code}>
            {option.nativeName}
          </option>
        ))}
      </select>
    </label>
  )
}
