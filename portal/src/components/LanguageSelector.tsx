import { Select, type SelectProps } from '@mantine/core'
import { Languages } from 'lucide-react'
import { useI18n } from '../i18n'

export default function LanguageSelector(props: Omit<SelectProps, 'data' | 'value' | 'onChange'>) {
  const { language, setLanguage, languages, t } = useI18n()

  return (
    <Select
      size="xs"
      w={150}
      allowDeselect={false}
      leftSection={<Languages size={14} aria-hidden />}
      aria-label={t('common.language')}
      value={language}
      onChange={(value) => value && setLanguage(value as typeof language)}
      data={languages.map((option) => ({ value: option.code, label: option.nativeName }))}
      comboboxProps={{ withinPortal: true }}
      {...props}
    />
  )
}
