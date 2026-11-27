// Browser tests for the Phase 4 UI: share links, theme, world map, quick add, leg reorder.
import { expect, test, type Page } from '@playwright/test'

const password = process.env.E2E_PASSWORD || ''
test.use({ timezoneId: 'America/Chicago', locale: 'en-US' })
test.skip(!password, 'E2E_PASSWORD not set')

async function signIn(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/$/)
}

const place = (name: string, lat: number, lng: number) => ({ id: '', name, city: name, coords: { lat, lng } })
const localToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }) // YYYY-MM-DD

async function makeTrip(page: Page, opts: { date?: string; legs?: number } = {}) {
  const id = `e2e${Date.now()}${Math.floor(Math.random() * 1000)}`
  const name = `E2E trip ${Math.random().toString(36).slice(2, 8)}` // must not contain the id
  const date = opts.date || '2026-12-01'
  const segments = Array.from({ length: opts.legs ?? 2 }, (_, i) => ({
    id: `${id}s${i}`,
    mode: 'drive',
    from: place(i ? 'Milwaukee' : 'Chicago', 41.9 + i, -87.6),
    to: place(i ? 'Madison' : 'Milwaukee', 43 + i, -87.9),
    distance: 90 + i,
    cost: 12.5,
    bookingRef: 'SECRET-BOOKING',
    stops: [],
  }))
  const res = await page.request.post('/api/trips', {
    data: {
      id, name, startDate: date, endDate: date, type: 'road_trip',
      days: [{ id: `${id}d1`, date, dayNumber: 1, segments, activities: [], visited: false, notes: 'SECRET-NOTE' }],
    },
  })
  expect(res.ok()).toBeTruthy()
  return { id, dayId: `${id}d1`, name }
}

test('share link: public read-only page without costs or secrets, and it can be turned off', async ({ page, browser }) => {
  await signIn(page)
  const trip = await makeTrip(page)
  await page.goto(`/trips/${trip.id}`)
  await page.getByRole('button', { name: 'Share trip' }).click()
  await page.getByRole('button', { name: /Create share link/ }).click()
  const url = await page.getByLabel('Share link').inputValue()
  expect(url).toMatch(/\/share\/[A-Za-z0-9_-]{43}$/)

  // someone without a login
  const guest = await browser.newContext()
  const g = await guest.newPage()
  const res = await g.goto(url)
  expect(res?.status()).toBe(200)
  expect(res?.headers()['x-robots-tag']).toContain('noindex')
  await expect(g.getByRole('heading', { name: trip.name })).toBeVisible()
  await expect(g.getByText('Chicago → Milwaukee').first()).toBeVisible()
  const html = await g.content()
  for (const secret of ['SECRET-BOOKING', 'SECRET-NOTE', '12.5', trip.id]) expect(html).not.toContain(secret)
  // the API stays closed to the guest
  expect((await g.request.get(`/api/trips/${trip.id}`)).status()).toBe(401)

  // turn it off
  await page.getByRole('button', { name: /Turn off sharing/ }).click()
  await page.getByRole('dialog', { name: 'Turn off sharing?' }).getByRole('button', { name: 'Turn off', exact: true }).click()
  await expect(page.getByRole('button', { name: /Create share link/ })).toBeVisible()
  // (status is 200: the root loading.tsx streams the page before it knows the link is gone)
  await g.goto(url)
  await expect(g.getByText('Page not found')).toBeVisible()
  expect(await g.content()).not.toContain(trip.name)
  await guest.close()

  // Esc closes only the top dialog
  await page.getByRole('button', { name: /Create share link/ }).click()
  await page.getByRole('button', { name: /New link/ }).click()
  await expect(page.getByRole('dialog')).toHaveCount(2)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.request.delete(`/api/trips/${trip.id}`)
})

test('theme: light/dark choice applies and survives a reload', async ({ page }) => {
  await signIn(page)
  await page.goto('/settings')
  await page.getByRole('radio', { name: 'Light' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(await bg()).toBe('rgb(246, 248, 251)')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('radio', { name: 'Dark' }).click()
  expect(await bg()).toBe('rgb(11, 17, 33)')
  await page.getByRole('radio', { name: 'Device' }).click()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
})

test('world map shows trips and totals', async ({ page }) => {
  await signIn(page)
  const trip = await makeTrip(page)
  await page.goto('/map')
  await expect(page.getByRole('heading', { name: /Where I.ve been/ })).toBeVisible()
  await expect(page.getByRole('link', { name: new RegExp(trip.name) })).toBeVisible()
  await expect(page.locator('.leaflet-container')).toBeVisible()
  await expect(page.locator('path.leaflet-interactive').first()).toBeAttached()
  await page.request.delete(`/api/trips/${trip.id}`)
})

test('quick add puts an expense on today', async ({ page }) => {
  await signIn(page)
  const trip = await makeTrip(page, { date: localToday() })
  await page.goto(`/trips/${trip.id}`)
  await page.getByRole('button', { name: 'Quick add to today' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: /fuel/ }).click()
  await dialog.getByPlaceholder(/What was it/).fill('Gas')
  await dialog.getByPlaceholder('0.00').fill('38.20')
  await dialog.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(dialog).toBeHidden()
  const expenses = await (await page.request.get(`/api/trips/${trip.id}/expenses`)).json()
  expect(expenses).toMatchObject([{ name: 'Gas', amount: 38.2, category: 'fuel', dayId: trip.dayId }])
  await page.request.delete(`/api/trips/${trip.id}`)
})

test('legs can be reordered on the day page', async ({ page }) => {
  await signIn(page)
  const trip = await makeTrip(page)
  await page.goto(`/trips/${trip.id}/day/${trip.dayId}`)
  await page.getByRole('button', { name: 'Move leg down' }).first().click()
  await expect
    .poll(async () => {
      const t = await (await page.request.get(`/api/trips/${trip.id}`)).json()
      return t.days[0].segments.map((s: { id: string }) => s.id.slice(-2)).join()
    })
    .toBe('s1,s0')
  await page.request.delete(`/api/trips/${trip.id}`)
})
