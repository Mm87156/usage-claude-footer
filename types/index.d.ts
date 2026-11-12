export type Limit = { percent: number; resetsAt?: string }
export type Reading = {
  context?: number
  five?: Limit
  week?: Limit
  cache?: number
}

declare module 'claude-code' {
  interface PluginState {
    'usage-footer': { reading: Reading | null }
  }
}
