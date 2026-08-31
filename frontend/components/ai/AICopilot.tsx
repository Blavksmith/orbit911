'use client'

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { sendChatMessage, ApiError } from '@/lib/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTED = [
  'Why was Zone B selected?',
  'What if Zone B becomes unobservable?',
  'Prioritize areas with hospitals.',
]

export default function AICopilot() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

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
          : 'AI service is currently unavailable.'
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `⚠ ${msg}` },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') send(input)
  }

  return (
    <div className="bg-slate-900 border-t border-slate-700 px-6 py-3 flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
          AI Copilot
        </span>
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <div className="flex gap-2 ml-1">
          {SUGGESTED.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              disabled={isLoading}
              className="text-slate-500 hover:text-slate-300 text-xs border border-slate-700 hover:border-slate-500 rounded px-2 py-0.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed hidden sm:block"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      {messages.length > 0 && (
        <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
          {messages.slice(-6).map((msg, i) => (
            <div key={i} className="flex gap-2 text-xs">
              <span
                className={`flex-shrink-0 font-semibold ${
                  msg.role === 'user' ? 'text-blue-400' : 'text-emerald-400'
                }`}
              >
                {msg.role === 'user' ? 'You' : 'AI'}
              </span>
              <span className="text-slate-300 leading-relaxed">{msg.content}</span>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-2 text-xs">
              <span className="text-emerald-400 font-semibold flex-shrink-0">AI</span>
              <span className="text-slate-500 italic">Thinking…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about the recommendation…"
          className="flex-1 bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded px-3 py-1.5 placeholder:text-slate-500 focus:outline-none focus:border-slate-500"
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || isLoading}
          type="button"
          className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 rounded px-3 py-1.5 transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
