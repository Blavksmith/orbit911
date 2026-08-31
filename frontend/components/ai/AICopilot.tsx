'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const MOCK_RESPONSES: Record<string, string> = {
  default:
    'Zone B — Ridgecrest was selected because it has the highest combined emergency priority and satellite feasibility score. With a severity of 90/100, active fire growth, and 42,000 people exposed, it is the most critical observable zone right now.',
  feasibility:
    'SAT-1 (EO-Alpha) is positioned directly over Zone B with a visibility score of 95/100 and a 12-minute observation window — the best available coverage right now.',
  zone_d:
    'Zone D — Mojave Outskirts has no satellite coverage available at this time, making it infeasible for observation regardless of its ground-level priority.',
}

function getMockResponse(question: string): string {
  const q = question.toLowerCase()
  if (q.includes('feasib') || q.includes('satellite') || q.includes('sat-1'))
    return MOCK_RESPONSES.feasibility
  if (q.includes('zone d') || q.includes('mojave') || q.includes('not observable'))
    return MOCK_RESPONSES.zone_d
  return MOCK_RESPONSES.default
}

const INITIAL_MESSAGES: Message[] = [
  { role: 'user', content: 'Why was Zone B selected?' },
  { role: 'assistant', content: MOCK_RESPONSES.default },
]

export default function AICopilot() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  function handleSend() {
    const text = input.trim()
    if (!text || isLoading) return

    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: getMockResponse(text) },
      ])
      setIsLoading(false)
    }, 700)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSend()
  }

  return (
    <div className="bg-slate-900 border-t border-slate-700 px-6 py-3 flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
          AI Copilot
        </span>
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span className="text-slate-500 text-xs">Ask about the recommendation</span>
      </div>

      {/* Chat messages — last 4 visible */}
      <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
        {messages.slice(-4).map((msg, i) => (
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
      </div>

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
          onClick={handleSend}
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
