import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(p){ super(p); this.state = { error: null } }
  static getDerivedStateFromError(error){ return { error } }
  componentDidCatch(error, info){ console.error('ErrorBoundary caught:', error, info) }
  render(){
    if (this.state.error) {
      return (
        <div style={{padding:16, background:'#fee', border:'1px solid #f99'}}>
          <h2>UI crashed</h2>
          <pre style={{whiteSpace:'pre-wrap'}}>{String(this.state.error)}</pre>
        </div>
      )
    }
    return this.props.children
  }
}
