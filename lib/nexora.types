// ============================================================
// NEXORA FOREX — Frontend Types
// Espelha exatamente bot.types.ts do backend
// ============================================================

export type BotStatus       = 'idle' | 'running' | 'paused' | 'stopped' | 'error'
export type BotStrategyType = 'scalping' | 'martingale' | 'anti_martingale' | 'trend_following'
export type TradeDirection  = 'CALL' | 'PUT'
export type LogLevel        = 'info' | 'warn' | 'error' | 'trade'

// ─── BotEventType (igual ao backend) ─────────────────────────
export type BotEventType =
  | 'bot:started'
  | 'bot:stopped'
  | 'bot:paused'
  | 'bot:resumed'
  | 'bot:error'
  | 'bot:trade_opened'
  | 'bot:trade_closed'
  | 'bot:stats_updated'
  | 'bot:log'

export interface BotEvent {
  type:    BotEventType
  botId:   string
  payload: Record<string, unknown>
}

// ─── BotStats (igual ao backend) ─────────────────────────────
export interface BotStats {
  totalTrades:   number
  wins:          number
  losses:        number
  totalProfit:   number
  totalLoss:     number
  netPnL:        number
  winRate:       number
  currentStreak: number
  currentStake:  number
  peakProfit:    number
  maxDrawdown:   number
}

// ─── BotConfig (igual ao backend) ────────────────────────────
export interface BotConfig {
  symbol:          string
  contractType:    string
  duration:        number
  durationUnit:    'ticks' | 's' | 'm' | 'h' | 'd'
  initialStake:    number
  currency:        string
  maxTrades?:      number
  maxLoss?:        number
  maxProfit?:      number
  strategyParams?: Record<string, unknown>
}

export interface BotLogEntry {
  timestamp: string
  level:     LogLevel
  message:   string
  data?:     Record<string, unknown>
}

// ─── BotSummary — o que listBots() devolve ───────────────────
export interface BotSummary {
  id:          string
  name:        string
  strategy:    BotStrategyType
  status:      BotStatus
  stats:       BotStats
  startedAt?:  string
  stoppedAt?:  string
}

export interface BotState extends BotSummary {
  config:      BotConfig
  lastError?:  string
  logs:        BotLogEntry[]
}

// ─── Payloads dos eventos emitidos pelo BaseStrategy ─────────
export interface TradeClosedPayload {
  contractId: string
  profit:     number
  won:        boolean
  stake:      number
}

export interface TradeOpenedPayload {
  contractId: string
  stake:      number
  direction:  TradeDirection
}

// ─── Mensagens Frontend → Backend ────────────────────────────
export type FrontendMsgType =
  | 'list_bots'
  | 'create_bot'
  | 'start_bot'
  | 'stop_bot'
  | 'pause_bot'
  | 'resume_bot'
  | 'delete_bot'
  | 'get_bot_logs'
  | 'ping'

// ─── Mensagens Backend → Frontend ────────────────────────────
export type BackendMsgType =
  | 'bots_list'
  | 'bot_created'
  | 'bot_logs'
  | 'bot_event'
  | 'error'
  | 'pong'

// ─── Definição de campo de formulário para UI ─────────────────
export interface StrategyFieldDef {
  key:          string
  label:        string
  type:         'number' | 'select' | 'toggle' | 'text'
  defaultValue: string | number | boolean
  min?:         number
  max?:         number
  step?:        number
  options?:     { value: string; label: string }[]
  description?: string
  group?:       string
}

// ─── Campos comuns (BotConfig) ────────────────────────────────
export const COMMON_CONFIG_FIELDS: StrategyFieldDef[] = [
  {
    key: 'symbol', label: 'Símbolo', type: 'select', defaultValue: 'R_100', group: 'Contrato',
    options: [
      { value: 'R_10',    label: 'Volatility 10 Index' },
      { value: 'R_25',    label: 'Volatility 25 Index' },
      { value: 'R_50',    label: 'Volatility 50 Index' },
      { value: 'R_75',    label: 'Volatility 75 Index' },
      { value: 'R_100',   label: 'Volatility 100 Index' },
      { value: '1HZ10V',  label: 'Volatility 10 (1s)' },
      { value: '1HZ100V', label: 'Volatility 100 (1s)' },
    ],
  },
  {
    key: 'contractType', label: 'Tipo de Contrato', type: 'select', defaultValue: 'CALL', group: 'Contrato',
    options: [
      { value: 'CALL',       label: 'Rise (Call)' },
      { value: 'PUT',        label: 'Fall (Put)' },
      { value: 'DIGITOVER',  label: 'Digit Over' },
      { value: 'DIGITUNDER', label: 'Digit Under' },
      { value: 'DIGITEVEN',  label: 'Digit Even' },
      { value: 'DIGITODD',   label: 'Digit Odd' },
    ],
  },
  {
    key: 'duration', label: 'Duração', type: 'number',
    defaultValue: 5, min: 1, max: 365, step: 1, group: 'Contrato',
  },
  {
    key: 'durationUnit', label: 'Unidade', type: 'select', defaultValue: 'ticks', group: 'Contrato',
    options: [
      { value: 'ticks', label: 'Ticks' },
      { value: 's',     label: 'Segundos' },
      { value: 'm',     label: 'Minutos' },
      { value: 'h',     label: 'Horas' },
      { value: 'd',     label: 'Dias' },
    ],
  },
  {
    key: 'initialStake', label: 'Stake Inicial (USD)', type: 'number',
    defaultValue: 1, min: 0.35, step: 0.01, group: 'Risco',
    description: 'Valor apostado no primeiro contrato',
  },
  {
    key: 'maxLoss', label: 'Perda Máxima (USD)', type: 'number',
    defaultValue: 20, min: 1, step: 0.5, group: 'Risco',
    description: 'Para o bot quando a perda acumulada atingir este valor',
  },
  {
    key: 'maxProfit', label: 'Take Profit (USD)', type: 'number',
    defaultValue: 50, min: 1, step: 0.5, group: 'Risco',
    description: 'Para o bot quando o lucro acumulado atingir este valor',
  },
  {
    key: 'maxTrades', label: 'Máx. Trades (0 = ilimitado)', type: 'number',
    defaultValue: 0, min: 0, step: 1, group: 'Risco',
  },
]

// ─── Parâmetros específicos por estratégia (strategyParams) ───
export const STRATEGY_PARAMS_FIELDS: Record<BotStrategyType, StrategyFieldDef[]> = {
  martingale: [
    {
      key: 'multiplier', label: 'Multiplicador', type: 'number',
      defaultValue: 2, min: 1.1, step: 0.1, group: 'Martingale',
      description: 'Fator de multiplicação do stake após perda',
    },
    {
      key: 'maxStake', label: 'Stake Máximo (USD)', type: 'number',
      defaultValue: 100, min: 1, step: 1, group: 'Martingale',
      description: 'Teto do stake para evitar apostas explosivas',
    },
    {
      key: 'resetOnWin', label: 'Modo Anti-Martingale', type: 'toggle',
      defaultValue: false, group: 'Martingale',
      description: 'Ativo = multiplica no win e reseta na perda',
    },
  ],
  anti_martingale: [
    {
      key: 'multiplier', label: 'Multiplicador', type: 'number',
      defaultValue: 2, min: 1.1, step: 0.1, group: 'Anti-Martingale',
      description: 'Fator de multiplicação do stake após vitória',
    },
    {
      key: 'maxStake', label: 'Stake Máximo (USD)', type: 'number',
      defaultValue: 100, min: 1, step: 1, group: 'Anti-Martingale',
    },
    {
      key: 'resetOnWin', label: 'Modo Anti-Martingale', type: 'toggle',
      defaultValue: true, group: 'Anti-Martingale',
    },
  ],
  scalping: [
    {
      key: 'maxConsecutiveLosses', label: 'Perdas Consecutivas Máx.', type: 'number',
      defaultValue: 3, min: 1, step: 1, group: 'Scalping',
      description: 'Pausa o bot após N perdas seguidas',
    },
  ],
  trend_following: [
    {
      key: 'ticksWindow', label: 'Janela de Ticks', type: 'number',
      defaultValue: 20, min: 5, max: 100, step: 1, group: 'Trend',
      description: 'Quantos ticks analisar para detectar tendência',
    },
    {
      key: 'trendThreshold', label: 'Limiar de Tendência', type: 'number',
      defaultValue: 0.002, min: 0.0001, step: 0.0001, group: 'Trend',
      description: 'Variação mínima para confirmar tendência (ex: 0.002 = 0.2%)',
    },
  ],
}

export const STRATEGY_LABELS: Record<BotStrategyType, string> = {
  scalping:        'Scalping',
  martingale:      'Martingale',
  anti_martingale: 'Anti-Martingale',
  trend_following: 'Trend Following',
}
