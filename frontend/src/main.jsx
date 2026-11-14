import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class MobileErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="h-full overflow-auto bg-bg p-6 text-ink">
          <div className="card mx-auto max-w-lg p-5">
            <h2 className="text-lg font-bold text-danger">Naija Pulse hit a runtime error</h2>
            <pre className="mt-3 whitespace-pre-wrap text-xs text-ink-2">
              {String(this.state.error?.message || this.state.error)}
            </pre>
            <button type="button" className="btn btn-primary mt-4" onClick={() => location.reload()}>
              Reload app
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MobileErrorBoundary>
      <App />
    </MobileErrorBoundary>
  </StrictMode>,
)
