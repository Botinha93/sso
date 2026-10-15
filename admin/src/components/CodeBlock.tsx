import { useMemo } from 'react'
import { Box, type BoxProps } from '@mantine/core'
import Prism from 'prismjs'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-typescript'

type CodeLanguage = 'json' | 'javascript' | 'typescript' | 'bash' | 'markup' | 'text'

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

export interface CodeBlockProps extends BoxProps {
  code: string
  language?: CodeLanguage
}

export default function CodeBlock({ code, language = 'text', className, ...others }: CodeBlockProps) {
  const highlighted = useMemo(() => {
    const grammar = Prism.languages[language]
    if (!grammar) {
      return escapeHtml(code)
    }

    return Prism.highlight(code, grammar, language)
  }, [code, language])

  return (
    <Box component="pre" className={['code-block', className].filter(Boolean).join(' ')} {...others}>
      <code className={`language-${language}`} dangerouslySetInnerHTML={{ __html: highlighted }} />
    </Box>
  )
}
