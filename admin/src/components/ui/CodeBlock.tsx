import { useMemo } from 'react'
import Prism from 'prismjs'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-typescript'

type CodeLanguage = 'json' | 'javascript' | 'typescript' | 'bash' | 'markup' | 'text'

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ')

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

export interface CodeBlockProps {
  code: string
  language?: CodeLanguage
  className?: string
}

export default function CodeBlock({ code, language = 'text', className }: CodeBlockProps) {
  const highlighted = useMemo(() => {
    const grammar = Prism.languages[language]
    if (!grammar) {
      return escapeHtml(code)
    }

    return Prism.highlight(code, grammar, language)
  }, [code, language])

  return (
    <pre className={cx('code-block', className)}>
      <code className={`language-${language}`} dangerouslySetInnerHTML={{ __html: highlighted }} />
    </pre>
  )
}