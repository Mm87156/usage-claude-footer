import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Reading } from '../types'

const reading = atom({ plugin: 'usage-footer', key: 'reading' } as const, null)

const WIDTH = 8
const GREEN = '#a6e3a1'
const YELLOW = '#f9e2af'
const RED = '#f38ba8'

function bar(percent: number): string {
  const p = Math.max(0, Math.min(100, percent))
  const filled = Math.round((p / 100) * WIDTH)
  return '█'.repeat(filled) + '░'.repeat(WIDTH - filled)
}

function tone(percent: number): string {
  return percent >= 85 ? RED : percent >= 60 ? YELLOW : GREEN
}

function left(resetsAt: string | undefined): string {
  if (!resetsAt) return ''
  const ms = Date.parse(resetsAt) - Date.now()
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const min = Math.round(ms / 60000)
  const d = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  const m = min % 60
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`
}

async function measure($: any, r: any): Promise<Reading> {
  const five = r.rateLimits.find((l: any) => l.kind === 'five_hour')
  const week = r.rateLimits.find((l: any) => l.kind === 'seven_day')
  let cache: number | undefined
  try {
    const u = (await $.session.usage({ breakdown: 'summary' })).context.breakdown?.apiUsage
    if (u) {
      const total = u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
      if (total > 0) cache = (u.cache_read_input_tokens / total) * 100
    }
  } catch {}
  return {
    context: r.context.percent,
    five: five && { percent: five.percentUsed, resetsAt: five.resetsAt },
    week: week && { percent: week.percentUsed, resetsAt: week.resetsAt },
    cache,
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'cp', description: 'Skrót: compact rozmowy' })
    try {
      const r = await measure($, await $.session.usage())
      await update($, reading, () => r)
    } catch {}
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const r = await measure($, e)
    await update($, reading, () => r)
    return next(e)
  })

  on('command.run', { command: 'cp' }, async $ => {
    try {
      await $.session.compact()
      return { text: 'Compact wykonany.' }
    } catch {
      return { text: 'Compact niemożliwy teraz (trwa tura).' }
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const r = await read($, reading)
    if (e.props.hasSurvey || r === null) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)

    const seg = (label: string, percent: number | undefined, reset = '') =>
      percent === undefined ? null : (
        <Text key={label}>
          <Text dimColor>{label} </Text>
          <Text color={tone(percent)}>{bar(percent)}</Text>
          <Text> {Math.round(percent)}%</Text>
          {reset ? <Text dimColor> {'↻'}{reset}</Text> : null}
        </Text>
      )

    return (
      <Box justifyContent="center" gap={3} marginTop={1}>
        {seg('kontekst', r.context)}
        {seg('5h', r.five?.percent, left(r.five?.resetsAt))}
        {seg('tydzień', r.week?.percent, left(r.week?.resetsAt))}
        {r.cache === undefined ? null : (
          <Text key="cache">
            <Text dimColor>cache </Text>
            <Text color={r.cache >= 70 ? GREEN : r.cache >= 30 ? YELLOW : RED}>
              {Math.round(r.cache)}%
            </Text>
          </Text>
        )}
        <Button
          key="compact"
          hotkey="c"
          label="compact"
          onPress={async () => {
            try { await $.session.compact() } catch {}
          }}
        />
      </Box>
    )
  })
}
