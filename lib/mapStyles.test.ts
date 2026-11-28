import { describe, expect, it } from 'vitest'
import { availableStyles, resolveStyle } from './mapStyles'

describe('map styles', () => {
  it('Google styles only when set up', () => {
    expect(availableStyles(false).some((s) => s.google)).toBe(false)
    expect(availableStyles(true).filter((s) => s.google)).toHaveLength(3)
  })
  it('auto follows the theme', () => {
    expect(resolveStyle('auto', { dark: false, google: false }).id).toBe('streets')
    expect(resolveStyle(null, { dark: true, google: false }).id).toBe('dark')
  })
  it('a Google choice falls back when Google is not set up', () => {
    expect(resolveStyle('google-satellite', { dark: false, google: false }).id).toBe('streets')
    expect(resolveStyle('google-satellite', { dark: false, google: true }).id).toBe('google-satellite')
  })
  it('satellite and dark are never dimmed', () => {
    expect(resolveStyle('satellite', { dark: true, google: false }).dimInDark).toBe(false)
    expect(resolveStyle('dark', { dark: true, google: false }).dimInDark).toBe(false)
    expect(resolveStyle('streets', { dark: true, google: false }).dimInDark).toBe(true)
  })
})
