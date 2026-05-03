import { useMemo, useState } from 'react'
import type { ApiExecutionResult } from '../types/api'

interface ApiResponsePanelProps {
  result: ApiExecutionResult | null
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

export function ApiResponsePanel({ result }: ApiResponsePanelProps) {
  const [copyMessage, setCopyMessage] = useState('')

  const responseText = useMemo(() => {
    if (!result) {
      return '{}'
    }

    return stringifyJson(result.body)
  }, [result])

  async function copyJson() {
    if (!result) {
      return
    }

    try {
      await navigator.clipboard.writeText(responseText)
      setCopyMessage('Copied JSON to clipboard.')
    } catch {
      setCopyMessage('Copy failed. Clipboard permission is unavailable.')
    }
  }

  return (
    <section className="response-card" aria-label="API response">
      <div className="response-head">
        <h2>Response</h2>
        <button type="button" className="btn" onClick={copyJson} disabled={!result}>
          Copy response JSON
        </button>
      </div>

      {result ? (
        <>
          <div className="response-meta">
            <p>
              <strong>Status:</strong> {result.status} {result.statusText}
            </p>
            <p>
              <strong>Time:</strong> {result.elapsedMs} ms
            </p>
            <p>
              <strong>Transport:</strong> {result.transport ?? 'direct'}
            </p>
          </div>

          {result.requestUrl ? (
            <p className="hint">
              <strong>Request URL:</strong> {result.requestUrl}
            </p>
          ) : null}

          {result.errorGroup ? (
            <div className="error-box">
              <p>
                <strong>{result.errorGroup}</strong>
              </p>
              {result.errorMessage ? <p>{result.errorMessage}</p> : null}
              {result.status === 429 ? (
                <p>Quota co the da het, hay doi API key hoac cho reset quota.</p>
              ) : null}
            </div>
          ) : null}

          <div className="headers-box">
            <h3>Headers</h3>
            <pre>{stringifyJson(result.headers)}</pre>
          </div>

          <div className="body-box">
            <h3>Body</h3>
            <pre>{responseText}</pre>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <p>Execute a request to see status code, headers, and formatted JSON response.</p>
        </div>
      )}

      {copyMessage ? <p className="hint">{copyMessage}</p> : null}
    </section>
  )
}
