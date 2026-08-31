'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Loader2, Bot } from 'lucide-react'
import { sendChatMessage, ApiError } from '@/lib/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
  isError?: boolean
}

const SUGGESTED = [
  'Why was Zone B selected?',
  'What if Zone B becomes unobservable?',
  'Prioritize areas with hospitals.',
  'Explain the scoring formula.',
]

export default function AICopilot() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Expand strip when messages arrive
  useEffect(() => {
    if (messages.length > 0) setIsExpanded(true)
  }, [messages.length])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return

    const userMsg: Message = { role: 'user', content: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const data = await sendChatMessage(trimmed)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.response },
      ])
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'AI service is currently unavailable. Check that the backend is running and GEMINI_API_KEY is set.'
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: msg, isError: true },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') send(input)
  }

  function handleSuggestedClick(q: string) {
    send(q)
    inputRef.current?.focus()
  }

  return (
    <div className="bg-slate-900 border-t border-slate-700 px-4 md:px-6 py-3 flex-shrink-0 flex flex-col gap-2">

      {/* ── Header row ── */}
      <div className="flex items-center gap-3">
        {/* AI label + status */}
        <button
          onClick={() => setIsExpanded((v) => !v)}
          aria-label="Toggle AI Copilot"
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none focus:ring-1 focus:ring-slate-600 rounded"
        >
          <Bot className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider">AI Copilot</span>
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${
              isLoading ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-400'
            }`}
            title={isLoading ? 'Thinking…' : 'Ready'}
          />
        </button>

        {/* Suggested question chips */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide flex-1">
          {SUGGESTED.map((q) => (
            <button
              key={q}
              onClick={() => handleSuggestedClick(q)}
              disabled={isLoading}
              aria-label={`Ask: ${q}`}
              className="text-slate-500 hover:text-slate-200 text-xs border border-slate-700 hover:border-slate-500 rounded px-2.5 py-0.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap hidden sm:block flex-shrink-0"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* ── Message history (collapsible) ── */}
      {isExpanded && messages.length > 0 && (
        <div className="flex flex-col gap-1.5 max-h-28 overflow-y-auto pr-1">
          {messages.slice(-6).map((msg, i) => (
            <div key={i} className="flex gap-2 text-xs">
              <span
                className={`flex-shrink-0 font-semibold pt-0.5 ${
                  msg.role === 'user' ? 'text-blue-400' : msg.isError ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {msg.role === 'user' ? 'You' : 'AI'}
              </span>
              <span
                className={`leading-relaxed ${
                  msg.isError ? 'text-red-300 italic' : 'text-slate-300'
                }`}
              >
                {msg.content}
              </span>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-2 text-xs items-center">
              <span className="text-emerald-400 font-semibold flex-shrink-0">AI</span>
              <Loader2 className="w-3 h-3 text-slate-500 animate-spin" />
              <span className="text-slate-500 italic">Thinking…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* ── Input row ── */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about the recommendation…"
          aria-label="AI Copilot input"
          className="flex-1 bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded px-3 py-1.5 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-700 focus:border-blue-700 transition-colors"
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || isLoading}
          type="button"
          aria-label="Send message"
          className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 rounded px-3 py-1.5 transition-colors focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  )
}
