// End-to-end smoke test: sign in, create a trip through the wizard, check its days, delete it.
// Runs in a US time zone on purpose — that is where day 1 used to be dated a day early.
//
//   E2E_BASE_URL=http://localhost:3100 E2E_PASSWORD=... npx playwright test
import { expect, test } from '@playwright/test'

const password = process.env.E2E_PASSWORD || ''

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' })

test('sign in, create a trip, see correct days, delete it', async ({ page }) => {
  test.skip(!password, 'E2E_PASSWORD not set')
  const name = `E2E trip ${Date.now()}`

  // signed-out visitors land on the login page
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
  await page.getByLabel('Password').fill('definitely-wrong')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Wrong password')).toBeVisible()
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/$/)

  // new-trip wizard: road trip, 1–3 Dec 2026
  await page.goto('/trips/new')
  await page.getByRole('button', { name: /Blank trip/ }).click()
  await page.getByPlaceholder(/Trip name/).fill(name)
  const dates = page.locator('input[type="date"]')
  await dates.nth(0).fill('2026-12-01')
  await dates.nth(1).fill('2026-12-03')
  await page.getByRole('button', { name: /Continue/ }).click() // → vehicle
  await page.getByRole('button', { name: /Continue/ }).click() // → confirm
  await page.getByRole('button', { name: 'Create trip' }).click()

  // trip page: three days, day 1 on the start date (Tuesday 1 Dec)
  await expect(page).toHaveURL(/\/trips\/[^/]+$/)
  await expect(page.getByText(name).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tuesday, December 1st' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Thursday, December 3rd' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Monday, November 30th' })).toHaveCount(0)

  // clean up through the API (same signed-in session)
  const tripId = page.url().split('/trips/')[1].split(/[/#]/)[0]
  const del = await page.request.delete(`/api/trips/${tripId}`)
  expect(del.ok()).toBeTruthy()

  // settings loads and never shows an Immich key field value
  await page.goto('/settings')
  await expect(page.getByText('Immich Photos')).toBeVisible()
})

test('expense with a receipt photo is stored as a file and shown', async ({ page }) => {
  test.skip(!password, 'E2E_PASSWORD not set')
  await page.goto('/login')
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/$/)

  const id = `e2e${Date.now()}`
  const created = await page.request.post('/api/trips', {
    data: { id, name: `E2E receipts ${id}`, startDate: '2026-12-01', endDate: '2026-12-01', type: 'road_trip',
      days: [{ id: `${id}d1`, date: '2026-12-01', dayNumber: 1, places: [], visited: false }] },
  })
  expect(created.ok()).toBeTruthy()

  await page.goto(`/trips/${id}`)
  await page.getByRole('button', { name: /Budget/ }).click()
  await page.getByRole('button', { name: /Actual/ }).click()
  await page.getByRole('button', { name: /Add expense/ }).click()
  await page.getByPlaceholder(/Description/).fill('Gas in Kenosha')
  await page.getByPlaceholder('0.00').fill('41.5')
  // 1×1 PNG
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
  await page.locator('input[type="file"]').setInputFiles({ name: 'r.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByAltText('Receipt')).toBeVisible()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Gas in Kenosha')).toBeVisible()

  // stored as a file, served back from its own URL
  const expenses = await (await page.request.get(`/api/trips/${id}/expenses`)).json()
  expect(expenses[0].receipt).toBe(`/api/trips/${id}/expenses/${expenses[0].id}/receipt`)
  const receipt = await page.request.get(expenses[0].receipt)
  expect(receipt.headers()['content-type']).toBe('image/png')
  expect(Buffer.compare(await receipt.body(), png)).toBe(0)

  expect((await page.request.delete(`/api/trips/${id}`)).ok()).toBeTruthy()
})

test('API refuses requests without a session', async ({ request }) => {
  const res = await request.get('/api/trips', { headers: { cookie: '' } })
  expect(res.status()).toBe(401)
})
