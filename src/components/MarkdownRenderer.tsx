import React, { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MarkdownRendererProps {
  content: string
  className?: string
  isStreaming?: boolean
}

type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'strong'; children: InlineToken[] }
  | { type: 'em'; children: InlineToken[] }
  | { type: 'code'; value: string }
  | { type: 'link'; text: string; href: string }
  | { type: 'highlight'; value: string }

type BlockToken =
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; children: InlineToken[] }
  | { type: 'paragraph'; children: InlineToken[] }
  | { type: 'ul'; items: InlineToken[][] }
  | { type: 'ol'; start: number; items: InlineToken[][] }
  | {
      type: 'table'
      headers: InlineToken[][]
      alignments: ('left' | 'center' | 'right')[]
      rows: InlineToken[][][]
    }
  | { type: 'codeblock'; language: string; code: string }
  | { type: 'blockquote'; children: InlineToken[] }
  | { type: 'hr' }

// Tokenize inline markdown string
function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = []
  let cursor = 0
  const len = text.length

  while (cursor < len) {
    // 1. Inline Code: `code`
    if (text[cursor] === '`') {
      const end = text.indexOf('`', cursor + 1)
      if (end !== -1) {
        tokens.push({ type: 'code', value: text.slice(cursor + 1, end) })
        cursor = end + 1
        continue
      }
    }

    // 2. Bold / Strong: **text** or __text__
    if (
      (text.startsWith('**', cursor) && text.length > cursor + 2) ||
      (text.startsWith('__', cursor) && text.length > cursor + 2)
    ) {
      const marker = text.slice(cursor, cursor + 2)
      const end = text.indexOf(marker, cursor + 2)
      if (end !== -1) {
        const inner = text.slice(cursor + 2, end)
        tokens.push({ type: 'strong', children: parseInline(inner) })
        cursor = end + 2
        continue
      }
    }

    // 3. Italic / Em: *text* or _text_ (excluding double asterisks/underscores)
    if (
      (text[cursor] === '*' && text[cursor + 1] !== '*') ||
      (text[cursor] === '_' && text[cursor + 1] !== '_')
    ) {
      const marker = text[cursor]
      // Avoid matching mid_word_snake_case if preceded by letter/number
      const prevChar = cursor > 0 ? text[cursor - 1] : ' '
      const isWordChar = (c: string) => /\w/.test(c)
      if (marker === '_' && isWordChar(prevChar)) {
        // Fall through to plain text
      } else {
        const end = text.indexOf(marker, cursor + 1)
        if (end !== -1 && end > cursor + 1) {
          const inner = text.slice(cursor + 1, end)
          tokens.push({ type: 'em', children: parseInline(inner) })
          cursor = end + 1
          continue
        }
      }
    }

    // 4. Markdown Links: [label](url)
    if (text[cursor] === '[') {
      const labelEnd = text.indexOf(']', cursor + 1)
      if (labelEnd !== -1 && text[labelEnd + 1] === '(') {
        const urlEnd = text.indexOf(')', labelEnd + 2)
        if (urlEnd !== -1) {
          const linkText = text.slice(cursor + 1, labelEnd)
          const linkHref = text.slice(labelEnd + 2, urlEnd).trim()
          tokens.push({ type: 'link', text: linkText, href: linkHref })
          cursor = urlEnd + 1
          continue
        }
      }
    }

    // 5. Plain text segment until the next special character
    let nextSpecial = len
    for (let i = cursor + 1; i < len; i++) {
      const char = text[i]
      if (char === '`' || char === '*' || char === '_' || char === '[') {
        nextSpecial = i
        break
      }
    }

    const plain = text.slice(cursor, nextSpecial)
    if (tokens.length > 0 && tokens[tokens.length - 1].type === 'text') {
      ;(tokens[tokens.length - 1] as { type: 'text'; value: string }).value += plain
    } else {
      tokens.push({ type: 'text', value: plain })
    }
    cursor = nextSpecial
  }

  return tokens
}

function parseTableLine(line: string): string[] {
  let trimmed = line.trim()
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1)
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1)
  return trimmed.split('|').map((col) => col.trim())
}

function isTableDelimiter(line: string): boolean {
  const parts = parseTableLine(line)
  if (parts.length === 0) return false
  return parts.every((p) => /^:?-+:?$/.test(p))
}

function parseAlignments(delimiterLine: string): ('left' | 'center' | 'right')[] {
  const parts = parseTableLine(delimiterLine)
  return parts.map((part) => {
    const startColon = part.startsWith(':')
    const endColon = part.endsWith(':')
    if (startColon && endColon) return 'center'
    if (endColon) return 'right'
    return 'left'
  })
}

// Tokenize block-level markdown
function parseBlocks(markdown: string): BlockToken[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: BlockToken[] = []
  let i = 0

  while (i < lines.length) {
    const rawLine = lines[i]
    const trimmed = rawLine.trim()

    // Empty lines
    if (!trimmed) {
      i++
      continue
    }

    // 1. Code blocks: ```lang ... ```
    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      if (i < lines.length) i++ // skip ending ```
      blocks.push({
        type: 'codeblock',
        language,
        code: codeLines.join('\n'),
      })
      continue
    }

    // 2. Horizontal rule: --- or *** or ___
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    // 3. Headings: # H1 ... ###### H6
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6
      const content = headingMatch[2].trim()
      blocks.push({
        type: 'heading',
        level,
        children: parseInline(content),
      })
      i++
      continue
    }

    // 4. Blockquotes: > quote
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        const quoteContent = lines[i].trim().replace(/^>\s?/, '')
        quoteLines.push(quoteContent)
        i++
      }
      blocks.push({
        type: 'blockquote',
        children: parseInline(quoteLines.join(' ')),
      })
      continue
    }

    // 5. Tables: header row followed by delimiter row |--|--|
    if (trimmed.includes('|') && i + 1 < lines.length && isTableDelimiter(lines[i + 1])) {
      const headers = parseTableLine(lines[i]).map(parseInline)
      const alignments = parseAlignments(lines[i + 1])
      i += 2
      const rows: InlineToken[][][] = []
      while (i < lines.length && lines[i].trim().includes('|')) {
        const rawCells = parseTableLine(lines[i])
        // Normaliza número de colunas com o header
        const cells: InlineToken[][] = []
        for (let c = 0; c < headers.length; c++) {
          const text = rawCells[c] ?? ''
          cells.push(parseInline(text))
        }
        rows.push(cells)
        i++
      }
      blocks.push({
        type: 'table',
        headers,
        alignments,
        rows,
      })
      continue
    }

    // 6. Unordered lists: - item, * item, + item
    const ulMatch = trimmed.match(/^[-*+]\s+(.*)$/)
    if (ulMatch) {
      const items: InlineToken[][] = []
      while (i < lines.length) {
        const curTrimmed = lines[i].trim()
        const curMatch = curTrimmed.match(/^[-*+]\s+(.*)$/)
        if (curMatch) {
          items.push(parseInline(curMatch[1]))
          i++
        } else if (
          curTrimmed &&
          !curTrimmed.startsWith('#') &&
          !curTrimmed.startsWith('```') &&
          !curTrimmed.match(/^\d+\.\s+/)
        ) {
          // Continuation line of the last list item
          if (items.length > 0) {
            const lastIdx = items.length - 1
            const extra = parseInline(' ' + curTrimmed)
            items[lastIdx] = [...items[lastIdx], ...extra]
          }
          i++
        } else {
          break
        }
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    // 7. Ordered lists: 1. item, 2. item
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/)
    if (olMatch) {
      const start = parseInt(olMatch[1], 10) || 1
      const items: InlineToken[][] = []
      while (i < lines.length) {
        const curTrimmed = lines[i].trim()
        const curMatch = curTrimmed.match(/^(\d+)\.\s+(.*)$/)
        if (curMatch) {
          items.push(parseInline(curMatch[2]))
          i++
        } else if (
          curTrimmed &&
          !curTrimmed.startsWith('#') &&
          !curTrimmed.startsWith('```') &&
          !curTrimmed.match(/^[-*+]\s+/)
        ) {
          // Continuation of last numbered item
          if (items.length > 0) {
            const lastIdx = items.length - 1
            const extra = parseInline(' ' + curTrimmed)
            items[lastIdx] = [...items[lastIdx], ...extra]
          }
          i++
        } else {
          break
        }
      }
      blocks.push({ type: 'ol', start, items })
      continue
    }

    // 8. Paragraph: normal text or multi-line paragraph
    const pLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('>') &&
      !lines[i].trim().match(/^[-*+]\s+/) &&
      !lines[i].trim().match(/^\d+\.\s+/) &&
      !(lines[i].trim().includes('|') && i + 1 < lines.length && isTableDelimiter(lines[i + 1]))
    ) {
      pLines.push(lines[i].trim())
      i++
    }

    if (pLines.length > 0) {
      blocks.push({
        type: 'paragraph',
        children: parseInline(pLines.join(' ')),
      })
    }
  }

  return blocks
}

function InlineRenderer({ tokens }: { tokens: InlineToken[] }) {
  return (
    <>
      {tokens.map((token, idx) => {
        switch (token.type) {
          case 'text':
            return <span key={idx}>{token.value}</span>
          case 'strong':
            return (
              <strong key={idx} className="font-semibold text-fin-text">
                <InlineRenderer tokens={token.children} />
              </strong>
            )
          case 'em':
            return (
              <em key={idx} className="italic text-fin-text/90">
                <InlineRenderer tokens={token.children} />
              </em>
            )
          case 'code':
            return (
              <code
                key={idx}
                className="mx-0.5 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] font-medium text-indigo-700 border border-slate-200/80 selection:bg-indigo-100"
              >
                {token.value}
              </code>
            )
          case 'link':
            return (
              <a
                key={idx}
                href={token.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-fin-primary underline decoration-indigo-300 underline-offset-2 hover:text-indigo-700 hover:decoration-indigo-500 transition"
              >
                {token.text}
              </a>
            )
          default:
            return null
        }
      })}
    </>
  )
}

function CodeBlockRenderer({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  return (
    <div className="group relative my-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-900 text-slate-100 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-3.5 py-1.5 text-xs text-slate-400">
        <span className="font-mono text-[11px] font-medium tracking-wide uppercase text-slate-300">
          {language || 'código'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800 hover:text-white transition"
          title="Copiar código"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400">Copiado</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto p-3.5 font-mono text-xs leading-relaxed selection:bg-indigo-500/30">
        <pre className="m-0 font-mono">{code}</pre>
      </div>
    </div>
  )
}

export function MarkdownRenderer({
  content,
  className,
  isStreaming = false,
}: MarkdownRendererProps) {
  if (!content) return null

  const blocks = parseBlocks(content)

  return (
    <div
      className={cn(
        'markdown-content space-y-3.5 text-sm leading-relaxed text-[#1e202e] break-words',
        className,
      )}
    >
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading': {
            const content = <InlineRenderer tokens={block.children} />
            if (block.level === 1) {
              return (
                <h1
                  key={idx}
                  className="text-xl font-bold text-fin-text mt-4 mb-2 tracking-tight border-b border-fin-border/70 pb-1.5"
                >
                  {content}
                </h1>
              )
            }
            if (block.level === 2) {
              return (
                <h2
                  key={idx}
                  className="text-lg font-bold text-fin-text mt-3.5 mb-2 tracking-tight border-b border-fin-border/50 pb-1"
                >
                  {content}
                </h2>
              )
            }
            if (block.level === 3) {
              return (
                <h3 key={idx} className="text-base font-semibold text-fin-text mt-3 mb-1.5">
                  {content}
                </h3>
              )
            }
            if (block.level === 4) {
              return (
                <h4 key={idx} className="text-sm font-semibold text-fin-text mt-2.5 mb-1">
                  {content}
                </h4>
              )
            }
            if (block.level === 5) {
              return (
                <h5
                  key={idx}
                  className="text-xs font-bold text-fin-text uppercase tracking-wider mt-2 mb-1"
                >
                  {content}
                </h5>
              )
            }
            return (
              <h6
                key={idx}
                className="text-xs font-semibold text-fin-muted uppercase tracking-wider mt-2 mb-1"
              >
                {content}
              </h6>
            )
          }

          case 'paragraph':
            return (
              <p key={idx} className="my-1.5 text-sm leading-relaxed text-fin-text">
                <InlineRenderer tokens={block.children} />
              </p>
            )

          case 'ul':
            return (
              <ul
                key={idx}
                className="my-2 ml-4 list-disc space-y-1.5 pl-1 text-fin-text marker:text-fin-primary"
              >
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="leading-relaxed">
                    <InlineRenderer tokens={item} />
                  </li>
                ))}
              </ul>
            )

          case 'ol':
            return (
              <ol
                key={idx}
                start={block.start}
                className="my-2 ml-4 list-decimal space-y-1.5 pl-1 text-fin-text marker:font-semibold marker:text-fin-primary"
              >
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="leading-relaxed">
                    <InlineRenderer tokens={item} />
                  </li>
                ))}
              </ol>
            )

          case 'blockquote':
            return (
              <blockquote
                key={idx}
                className="my-2.5 border-l-3 border-fin-primary bg-indigo-50/50 py-2 px-3.5 rounded-r-lg text-sm italic text-fin-text shadow-2xs"
              >
                <InlineRenderer tokens={block.children} />
              </blockquote>
            )

          case 'table':
            return (
              <div
                key={idx}
                className="my-3 w-full overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-2xs"
              >
                <table className="w-full min-w-[340px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/90 text-fin-text">
                      {block.headers.map((h, hIdx) => {
                        const align = block.alignments[hIdx] || 'left'
                        const alignClass =
                          align === 'center'
                            ? 'text-center'
                            : align === 'right'
                              ? 'text-right'
                              : 'text-left'
                        return (
                          <th
                            key={hIdx}
                            className={cn(
                              'px-3.5 py-2.5 font-semibold text-fin-text uppercase tracking-wider text-[11px]',
                              alignClass,
                            )}
                          >
                            <InlineRenderer tokens={h} />
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-fin-text">
                    {block.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className="transition-colors hover:bg-indigo-50/30 odd:bg-white even:bg-slate-50/40"
                      >
                        {row.map((cell, cIdx) => {
                          const align = block.alignments[cIdx] || 'left'
                          const alignClass =
                            align === 'center'
                              ? 'text-center'
                              : align === 'right'
                                ? 'text-right'
                                : 'text-left'
                          return (
                            <td
                              key={cIdx}
                              className={cn('px-3.5 py-2.5 leading-normal', alignClass)}
                            >
                              <InlineRenderer tokens={cell} />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )

          case 'codeblock':
            return <CodeBlockRenderer key={idx} language={block.language} code={block.code} />

          case 'hr':
            return <hr key={idx} className="my-4 border-slate-200/80" />

          default:
            return null
        }
      })}

      {isStreaming && (
        <span
          className="inline-block h-4 w-1.5 animate-pulse rounded-full bg-fin-primary ml-0.5 align-middle"
          aria-hidden="true"
        />
      )}
    </div>
  )
}

export default MarkdownRenderer
