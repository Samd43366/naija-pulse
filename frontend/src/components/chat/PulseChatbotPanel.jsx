import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Bot, Compass, RotateCcw, Sparkles } from 'lucide-react'
import { askPulseAi } from '../../api/chat'

const STARTER_PROMPTS = [
  { emoji: '🇳🇬', label: 'Nationwide summary', prompt: 'Give me a nationwide summary across all 36 states and FCT' },
  { emoji: '🛡️', label: 'Borno situation', prompt: 'What is happening in Borno state right now?' },
  { emoji: '⚡', label: 'Lagos power & roads', prompt: 'What is the power outage and road traffic status in Lagos?' },
  { emoji: '🌊', label: 'Rivers flood alerts', prompt: 'Show flood alerts in Rivers and Bayelsa' },
  { emoji: '🛣️', label: 'Abuja to Kaduna safety', prompt: 'Is Abuja to Kaduna highway safe for travel?' },
  { emoji: '☎️', label: 'Emergency hotlines', prompt: 'What are the official emergency phone numbers in Nigeria?' },
  { emoji: '🧠', label: 'How trust scores work', prompt: 'Explain how Naija Pulse Bayesian trust and privacy protection work' },
  { emoji: '🏛️', label: 'Kano live report', prompt: 'What incidents are active in Kano state?' },
  { emoji: '📰', label: 'Latest Nigeria news', prompt: 'What are the latest news headlines in Nigeria?' },
  { emoji: '✨', label: 'Places to explore', prompt: 'What fun places can I visit in Lagos?' },
]

// Safe inline formatter for **bold**, `code`, and *italic* without dangerouslySetInnerHTML
function renderInlineTokens(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-bold text-ink">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="rounded-md bg-surface-3 px-1.5 py-0.5 font-mono text-[12px] text-brand">
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={i} className="italic text-ink-2">
          {part.slice(1, -1)}
        </em>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function RichMessageBody({ text }) {
  const lines = String(text || '').split('\n')
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-ink-2 break-words">
      {lines.map((raw, idx) => {
        const line = raw.trim()
        if (!line) return <div key={idx} className="h-1" />
        if (line.startsWith('### ')) {
          return (
            <h4 key={idx} className="pt-1 text-[15px] font-bold text-ink">
              {renderInlineTokens(line.slice(4))}
            </h4>
          )
        }
        if (line.startsWith('## ')) {
          return (
            <h3 key={idx} className="pt-1 text-base font-bold text-ink">
              {renderInlineTokens(line.slice(3))}
            </h3>
          )
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-0.5">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              <span>{renderInlineTokens(line.slice(2))}</span>
            </div>
          )
        }
        const numMatch = line.match(/^(\d+)\.\s+(.*)$/)
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-0.5">
              <span className="shrink-0 font-mono text-xs font-bold text-brand">{numMatch[1]}.</span>
              <span>{renderInlineTokens(numMatch[2])}</span>
            </div>
          )
        }
        return <p key={idx}>{renderInlineTokens(line)}</p>
      })}
    </div>
  )
}

export default function PulseChatbotPanel({ incidents, onFlyToPlace }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollerRef = useRef(null)
  const inputRef = useRef(null)
  const latestMsgRef = useRef(null)
  const prevMsgCountRef = useRef(0)

  // Stable scrolling: only scrolls the internal message container when new messages arrive.
  // NEVER scrolls on mount or when empty, and NEVER uses window-level scrollIntoView.
  // If an incoming assistant reply is tall (e.g. detailed nationwide report), we scroll to
  // the start of that exchange so the user can read from the top instead of being dumped at the bottom!
  useEffect(() => {
    if (messages.length === 0) {
      prevMsgCountRef.current = 0
      return
    }

    const scroller = scrollerRef.current
    if (!scroller) return

    const timer = setTimeout(() => {
      const el = latestMsgRef.current
      if (el) {
        const elTop = el.offsetTop - 12
        const elHeight = el.offsetHeight
        // If the reply is tall (more than 60% of viewport height), align near top of the message
        if (elHeight > scroller.clientHeight * 0.6) {
          scroller.scrollTo({ top: Math.max(0, elTop), behavior: 'smooth' })
        } else {
          scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' })
        }
      } else {
        scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' })
      }
    }, 60)

    prevMsgCountRef.current = messages.length
    return () => clearTimeout(timer)
  }, [messages.length, loading])

  async function handleSend(rawPrompt) {
    const question = (rawPrompt ?? input).trim()
    if (!question || loading) return

    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', reply: question }])
    if (rawPrompt === undefined) setInput('')
    setLoading(true)

    try {
      const res = await askPulseAi(question, incidents)
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          reply: res.reply,
          engine: res.engine || 'PulseAI Hybrid RAG',
          map_action: res.map_action || null,
        },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const empty = messages.length === 0

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-bg">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-brand-ink shadow-[0_6px_16px_color-mix(in_srgb,var(--brand)_30%,transparent)]">
            <Sparkles size={20} />
          </span>
          <div>
            <h1 className="font-display text-base font-extrabold text-ink sm:text-lg">Pulse AI</h1>
            <p className="text-[11px] text-ink-3">
              Grounded in {incidents.length.toLocaleString()} live incidents, Nigeria news, and the places atlas
            </p>
          </div>
        </div>
        {!empty && (
          <button type="button" onClick={() => setMessages([])} className="btn btn-ghost !px-3 !py-2 text-xs">
            <RotateCcw size={14} />
            New chat
          </button>
        )}
      </div>

      {/* Conversation / Empty State Scroll Area */}
      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
      >
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-3 py-3 sm:px-6 sm:py-5">
          {empty ? (
            <div className="my-auto flex w-full flex-col items-center justify-center py-2 text-center sm:py-6">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand sm:h-14 sm:w-14 sm:rounded-3xl">
                <Bot size={28} className="sm:hidden" />
                <Bot size={32} className="hidden sm:block" />
              </span>
              <h2 className="mt-3 font-display text-xl font-extrabold text-ink sm:mt-4 sm:text-3xl">
                Ask me anything about Nigeria’s safety.
              </h2>
              <p className="mx-auto mt-1.5 max-w-md text-xs text-ink-3 sm:mt-2 sm:text-sm">
                Live incidents in any state, route safety, flood alerts, power status, emergency
                hotlines, or general questions.
              </p>

              {/* Starter Prompt Cards: 2 compact columns on mobile, clean cards on desktop */}
              <div className="mt-4 grid w-full grid-cols-2 gap-2 text-left sm:mt-6 sm:gap-2.5">
                {STARTER_PROMPTS.map((chip, idx) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => handleSend(chip.prompt)}
                    className={`card group flex items-center gap-2 p-2.5 transition active:scale-[0.98] hover:border-brand sm:gap-3 sm:p-3.5 ${
                      idx >= 6 ? 'hidden sm:flex' : ''
                    }`}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-base sm:h-9 sm:w-9 sm:rounded-xl sm:text-lg">
                      {chip.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-ink sm:text-sm">
                        {chip.label}
                      </span>
                      <span className="hidden truncate text-[11px] text-ink-3 sm:block">
                        {chip.prompt}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2 sm:space-y-5">
              {messages.map((msg, index) => {
                const isUser = msg.role === 'user'
                const isLast = index === messages.length - 1
                return isUser ? (
                  <div key={msg.id} ref={isLast ? latestMsgRef : null} className="flex justify-end">
                    <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-sm font-medium leading-relaxed text-brand-ink shadow-sm">
                      {msg.reply}
                    </p>
                  </div>
                ) : (
                  <div key={msg.id} ref={isLast ? latestMsgRef : null} className="flex items-start gap-2.5 sm:gap-3">
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                      <Sparkles size={16} />
                    </span>
                    <div className="card min-w-0 max-w-[92%] rounded-tl-md px-3.5 py-3 sm:px-4">
                      <RichMessageBody text={msg.reply} />
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5">
                        <span className="text-[10.5px] font-medium text-ink-3">{msg.engine}</span>
                        {msg.map_action && (
                          <button
                            type="button"
                            onClick={() => onFlyToPlace?.(msg.map_action)}
                            className="btn btn-soft !px-3 !py-1.5 text-xs"
                          >
                            <Compass size={13} />
                            {msg.map_action.label}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {loading && (
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                    <Sparkles size={16} />
                  </span>
                  <div className="card flex items-center gap-2 rounded-tl-md px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-2 w-2 rounded-full bg-brand animate-pulse"
                          style={{ animationDelay: `${i * 200}ms` }}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-ink-3">Consulting live database…</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSend()
        }}
        className="shrink-0 border-t border-line bg-surface px-3 py-2.5 sm:px-6 sm:py-3 lg:px-8"
      >
        {!empty && (
          <div className="scrollbar-none mx-auto mb-2 flex max-w-3xl gap-1.5 overflow-x-auto overflow-y-hidden overscroll-contain px-0.5">
            {STARTER_PROMPTS.slice(0, 6).map((chip) => (
              <button
                key={chip.label}
                type="button"
                disabled={loading}
                onClick={() => handleSend(chip.prompt)}
                className="chip shrink-0 disabled:opacity-50"
              >
                {chip.emoji} {chip.label}
              </button>
            ))}
          </div>
        )}
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about any state, road, emergency…"
            aria-label="Message Pulse AI"
            className="field min-w-0 flex-1 !rounded-full !py-2.5 !pl-4 !pr-3 text-base sm:!py-3 sm:!pl-5 sm:text-sm"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            aria-label="Send message"
            className="btn btn-primary !h-10 !w-10 sm:!h-11 sm:!w-11 shrink-0 !rounded-full !p-0"
          >
            <ArrowUp size={19} strokeWidth={2.6} />
          </button>
        </div>
      </form>
    </div>
  )
}
