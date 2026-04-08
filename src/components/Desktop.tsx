import type { FC } from 'hono/jsx'

interface DesktopProps {
  role: 'owner' | 'guest'
  csrfToken: string
}

export const Desktop: FC<DesktopProps> = ({ role, csrfToken }) => {
  return (
    <div class="desktop" data-theme="dark" id="desktop" data-csrf={csrfToken} data-role={role}>
      <div class="desktop__wallpaper" aria-hidden="true" />
      <div class="desktop__windows" id="windows-container" />
    </div>
  )
}
