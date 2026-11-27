// lib/theme.ts — light / dark / follow-the-device. The choice is kept in this browser only.
export type ThemeChoice = 'system' | 'light' | 'dark'
export const THEME_KEY = 'tp-theme'

/** Runs in <head> before the page paints, so there is no flash of the wrong theme. */
export const themeInitScript = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`

export function readTheme(): ThemeChoice {
  try {
    const t = localStorage.getItem(THEME_KEY)
    return t === 'light' || t === 'dark' ? t : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement
  if (choice === 'system') delete root.dataset.theme
  else root.dataset.theme = choice
  try {
    if (choice === 'system') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, choice)
  } catch {
    // private window etc. — the choice just won't be remembered
  }
}
