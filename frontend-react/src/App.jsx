
import { useEffect, useRef, useState } from 'react'
import {
  BrainCircuit, Plus, MessageSquare, Trash2, Upload,
  FileText, Send, Paperclip, Sparkles, Settings,
  ChevronDown, PanelLeftClose, Activity, Bot,
  Database, Wrench, CheckCircle2, LoaderCircle,
  X, Menu
} from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

function getTool(sources = []) {
  const source = sources.find(s => s.startsWith('external_tools:'))
  return source ? source.split(':')[1] : null
}

function App() {
  const [messages, setMessages] = useState([])
  const [threads, setThreads] = useState([])
  const [threadId, setThreadId] = useState(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activity, setActivity] = useState('')
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showDetails, setShowDetails] = useState({})
  const [error, setError] = useState('')
  const [backendOnline, setBackendOnline] = useState(false)

  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    loadThreads()
    checkBackend()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activity])

  async function checkBackend() {
    try {
      const response = await fetch(`${API.replace('/api/v1', '')}/health`)
      setBackendOnline(response.ok)
    } catch {
      setBackendOnline(false)
    }
  }

  async function loadThreads() {
    try {
      const response = await fetch(`${API}/threads`)
      if (!response.ok) throw new Error('History unavailable')
      const data = await response.json()
      setThreads(data)
    } catch {
      setThreads([])
    }
  }

  async function loadThread(id) {
    try {
      const response = await fetch(`${API}/threads/${id}/messages`)
      if (!response.ok) throw new Error('Could not load conversation')

      const data = await response.json()

      setMessages(data.map(m => ({
        role: m.role,
        content: m.content,
        sources: m.sources || [],
        tool_used: getTool(m.sources || [])
      })))

      setThreadId(id)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  function newChat() {
    setMessages([])
    setThreadId(null)
    setInput('')
    setActivity('')
    setError('')
  }

  async function deleteThread(id) {
    try {
      const response = await fetch(`${API}/threads/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Delete failed')

      if (threadId === id) newChat()
      await loadThreads()
    } catch (err) {
      setError(err.message)
    }
  }

  async function uploadDocuments() {
    if (!files.length) return

    setUploading(true)
    setError('')

    try {
      const form = new FormData()

      files.forEach(file => {
        form.append('files', file)
      })

      const response = await fetch(`${API}/ingest`, {
        method: 'POST',
        body: form
      })

      if (!response.ok) {
        const detail = await response.text()
        throw new Error(detail || 'Upload failed')
      }

      const result = await response.json()

      setActivity(
        result.map(r => `${r.filename}: ${r.chunks_ingested} chunks indexed`).join('\n')
      )

      setFiles([])
    } catch (err) {
      setError(`Document upload failed: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  async function sendMessage(event) {
    event?.preventDefault()

    const question = input.trim()
    if (!question || loading) return

    setInput('')
    setError('')
    setLoading(true)
    setActivity('Classifying your question...')

    setMessages(prev => [
      ...prev,
      { role: 'user', content: question },
      {
        role: 'assistant',
        content: '',
        sources: [],
        tool_used: null,
        pending: true
      }
    ])

    try {
      const response = await fetch(`${API}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          thread_id: threadId
        })
      })

      if (!response.ok) {
        throw new Error(`Backend returned HTTP ${response.status}`)
      }

      if (!response.body) {
        throw new Error('Streaming is not supported by this response')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      let buffer = ''
      let answer = ''
      let sources = []
      let toolUsed = null
      let finished = false

      function updateAssistant(changes) {
        setMessages(prev => {
          const copy = [...prev]
          const last = copy.length - 1
          copy[last] = { ...copy[last], ...changes }
          return copy
        })
      }

      function processFrame(frame) {
        let eventName = ''
        let dataText = ''

        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            dataText += line.slice(5).trim()
          }
        }

        if (!eventName) return

        let data = {}
        try {
          data = JSON.parse(dataText)
        } catch {
          return
        }

        if (eventName === 'routing') {
          setActivity(`Classified as: ${data.query_type}`)
        }

        if (eventName === 'tool_call') {
          toolUsed = data.tool_used
          setActivity(`Executing MCP tool: ${toolUsed}`)
        }

        if (eventName === 'retry') {
          setActivity(`Workflow update: ${data.stage}`)
        }

        if (eventName === 'token') {
          answer += data.text || ''
          updateAssistant({
            content: answer,
            pending: true
          })
        }

        if (eventName === 'done') {
          sources = data.sources || []
          toolUsed = data.tool_used || toolUsed

          setThreadId(data.thread_id || null)

          updateAssistant({
            content: answer,
            sources,
            tool_used: toolUsed,
            pending: false
          })

          setActivity('')
          finished = true
        }

        if (eventName === 'error') {
          throw new Error(data.detail || 'Streaming failed')
        }
      }

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const frames = buffer.split('\n\n')
        buffer = frames.pop() || ''

        for (const frame of frames) {
          processFrame(frame)
        }
      }

      buffer += decoder.decode()
      if (buffer.trim()) processFrame(buffer)

      if (!finished) {
        throw new Error('The backend stream ended without a completion event')
      }

      await loadThreads()

    } catch (err) {
      setError(err.message)

      setMessages(prev => {
        const copy = [...prev]
        const last = copy.length - 1

        if (last >= 0 && copy[last].role === 'assistant') {
          copy[last] = {
            ...copy[last],
            content: `Unable to complete the request: ${err.message}`,
            pending: false
          }
        }

        return copy
      })

      setActivity('')
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function toggleDetails(index) {
    setShowDetails(prev => ({
      ...prev,
      [index]: !prev[index]
    }))
  }

  return (
    <div className="app-shell">

      {/* SIDEBAR */}
      {sidebarOpen && (
        <aside className="sidebar">

          <div className="brand flex items-center gap-3 mb-9">
            <div className="brand-mark">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="brand-name text-lg font-extrabold tracking-tight">
                Nexa
              </div>
              <div className="text-[9px] uppercase tracking-[2px] text-[#92899f]">
                Enterprise intelligence
              </div>
            </div>
          </div>

          <button
            onClick={newChat}
            className="sidebar-button active mb-3"
          >
            <Plus size={17} />
            <span className="sidebar-text font-semibold">New conversation</span>
          </button>

          <div className="side-heading">Workspace</div>

          <div className="flex flex-col gap-1">
            <button className="sidebar-button active">
              <MessageSquare size={16} />
              <span className="sidebar-text">AI Assistant</span>
            </button>
          </div>

          <div className="side-heading">Recent conversations</div>

          <div className="flex-1 overflow-y-auto">
            {threads.length === 0 && (
              <p className="text-xs text-[#888293] px-2">
                No conversations yet.
              </p>
            )}

            {threads.map(thread => (
              <div key={thread.id} className="flex items-center gap-1 group">
                <button
                  onClick={() => loadThread(thread.id)}
                  className={`history-item flex-1 ${
                    threadId === thread.id ? 'selected' : ''
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare size={13} />
                    {thread.title}
                  </span>
                </button>

                <button
                  onClick={() => deleteThread(thread.id)}
                  className="icon-button opacity-0 group-hover:opacity-100"
                  title="Delete conversation"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          {/* DOCUMENT UPLOAD */}
          <div className="side-heading">Knowledge library</div>

          <div className="upload-zone">
            <div className="flex items-center gap-2 font-semibold">
              <FileText size={17} />
              Add PDF documents
            </div>

            <p className="text-[10px] text-[#a9a0b5] mt-2">
              Upload documents to your searchable knowledge base.
            </p>

            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              multiple
              onChange={e => setFiles(Array.from(e.target.files || []))}
            />

            {files.length > 0 && (
              <div className="mt-2 text-[10px]">
                {files.length} file(s) selected
              </div>
            )}

            <button
              onClick={uploadDocuments}
              disabled={!files.length || uploading}
              className="upload-button disabled:opacity-40"
            >
              {uploading ? 'Processing...' : 'Upload & index'}
            </button>
          </div>

          <div className="mt-5 pt-4 border-t border-[#403a48]">
            <div className="flex items-center gap-2 text-xs text-[#bcb5c9]">
              <Activity size={14} />
              <span>Backend connection</span>
              <span className={`ml-auto w-2 h-2 rounded-full ${
                backendOnline ? 'bg-emerald-400' : 'bg-red-400'
              }`} />
            </div>

            <div className="text-[10px] text-[#81798e] mt-2">
              Qwen 2.5 · Ollama · LangGraph
            </div>
          </div>

        </aside>
      )}

      {/* MAIN WORKSPACE */}
      <main className="main-panel">

        {/* TOP HEADER */}
        <header className="header-bar">

          <div className="flex items-center gap-3">
            <button
              className="icon-button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title="Toggle sidebar"
            >
              <PanelLeftClose size={18} />
            </button>

            <div>
              <div className="text-[14px] font-bold text-[#302b38]">
                NEXORA
              </div>
              <div className="text-[10px] text-[#96909d]">
                Enterprise Intelligence Platform
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="status-pill">
              <span className="status-dot" />
              Local AI
            </span>

            <div className="w-9 h-9 rounded-xl bg-[#eee8f5] text-[#7955a8] flex items-center justify-center font-bold text-sm">
              N
            </div>
          </div>

        </header>

        {/* CHAT AREA */}
        <section className="chat-content">
          <div className="chat-inner">

            {/* WELCOME */}
            {messages.length === 0 && (
              <div className="min-h-[55vh] flex flex-col justify-center">

                <div className="mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#a77cdb] to-[#e38ca1] flex items-center justify-center text-white shadow-lg shadow-purple-200">
                    <BrainCircuit size={27} />
                  </div>
                </div>

                <div className="text-[11px] tracking-[2px] font-bold text-[#9274b3] uppercase mb-4">
                  Your intelligent workspace
                </div>

                <h1 className="welcome-title">
                  Hello. What would<br />
                  you like to <span>explore?</span>
                </h1>

                <p className="welcome-subtitle mt-4 max-w-[450px]">
                  Ask about your company documents, retrieve enterprise
                  information or interact with connected tools.
                </p>

                <div className="flex flex-wrap gap-2 mt-7">
                  <span className="text-[11px] text-[#96909d] border border-[#e5dfea] rounded-full px-3 py-2">
                    <Database size={12} className="inline mr-2 text-[#9274b3]" />
                    Document intelligence
                  </span>
                  <span className="text-[11px] text-[#96909d] border border-[#e5dfea] rounded-full px-3 py-2">
                    <Wrench size={12} className="inline mr-2 text-[#9274b3]" />
                    Enterprise tools
                  </span>
                  <span className="text-[11px] text-[#96909d] border border-[#e5dfea] rounded-full px-3 py-2">
                    <Bot size={12} className="inline mr-2 text-[#9274b3]" />
                    Local AI
                  </span>
                </div>

              </div>
            )}

            {/* MESSAGES */}
            {messages.map((message, index) => (
              <div key={index} className="message-row">

                <div className={`message-avatar ${
                  message.role === 'user' ? 'user-avatar' : 'ai-avatar'
                }`}>
                  {message.role === 'user' ? 'U' : <Sparkles size={16} />}
                </div>

                <div className="message-body">

                  <div className="text-[11px] font-bold text-[#8f8997] mb-2">
                    {message.role === 'user' ? 'YOU' : 'NEXA'}
                  </div>

                  <div className={
                    message.role === 'user'
                      ? 'user-message'
                      : 'ai-message'
                  }>
                    {message.content}

                    {message.pending && (
                      <span className="loading-dot ml-2" />
                    )}
                  </div>

                  {message.role === 'assistant' &&
                    (message.sources?.length > 0 || message.tool_used) && (
                    <div className="mt-3">

                      <button
                        onClick={() => toggleDetails(index)}
                        className="text-[11px] text-[#9476b6] hover:text-[#67469a] flex items-center gap-2"
                      >
                        <Activity size={13} />
                        Response details
                        <ChevronDown size={13} />
                      </button>

                      {showDetails[index] && (
                        <div className="detail-panel">
                          {message.sources?.length > 0 && (
                            <div>
                              <strong>Sources</strong>
                              {message.sources.map((source, i) => (
                                <div key={i} className="mt-1">{source}</div>
                              ))}
                            </div>
                          )}

                          {message.tool_used && (
                            <div className="mt-3">
                              <strong>MCP tool</strong>
                              <div className="mt-1">{message.tool_used}</div>
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  )}

                </div>
              </div>
            ))}

            {loading && activity && (
              <div className="activity-line">
                <LoaderCircle size={14} className="animate-spin" />
                {activity}
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-xl mb-4">
                {error}
              </div>
            )}

            {bottomRef && <div ref={bottomRef} />}

          </div>
        </section>

        {/* MESSAGE COMPOSER */}
        <div className="composer-wrap">

          <form className="composer" onSubmit={sendMessage}>

            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="Ask NEXORA anything..."
            />

            <div className="flex items-center justify-between mt-2">

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="icon-button"
                  title="Add documents"
                >
                  <Paperclip size={17} />
                </button>

                <span className="text-[10px] text-[#a09aa6]">
                  Shift + Enter for a new line
                </span>
              </div>

              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="send-button"
                title="Send message"
              >
                <Send size={16} />
              </button>

            </div>

          </form>

          <div className="text-center text-[10px] text-[#aaa4b0] mt-3">
            Powered by Qwen 2.5 · LangGraph · RAG · MCP
          </div>

        </div>

      </main>
    </div>
  )
}

export default App
