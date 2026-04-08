import type { FC, PropsWithChildren } from 'hono/jsx'

interface WindowProps {
  id: string
  app: string
  title: string
  x?: number
  y?: number
  width?: number
  height?: number
  zIndex?: number
}

export const Window: FC<PropsWithChildren<WindowProps>> = ({
  id,
  app,
  title,
  x = 100,
  y = 80,
  width = 700,
  height = 500,
  zIndex = 10,
  children,
}) => {
  return (
    <div
      class="window"
      id={`win-${id}`}
      data-app={app}
      data-window-id={id}
      data-title={title}
      style={`--x:${x}px; --y:${y}px; --w:${width}px; --h:${height}px; --z:${zIndex};`}
      aria-label={title}
    >
      <header class="window__chrome" aria-label="Window controls">
        <span class="window__title">{title}</span>
        <div class="window__controls" aria-label="Window actions">
          <button
            type="button"
            class="window__btn window__btn--minimise"
            aria-label="Minimise"
            data-action="minimise"
          >
            −
          </button>
          <button
            type="button"
            class="window__btn window__btn--maximise"
            aria-label="Maximise"
            data-action="maximise"
          >
            □
          </button>
          <button
            type="button"
            class="window__btn window__btn--close"
            aria-label="Close"
            hx-delete={`/windows/${id}`}
            hx-target={`#win-${id}`}
            hx-swap="delete"
          >
            ×
          </button>
        </div>
      </header>
      <div class="window__body" hx-get={`/apps/${app}`} hx-trigger="load">
        {children}
      </div>
    </div>
  )
}
