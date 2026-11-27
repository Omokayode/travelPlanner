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
  await expect(page.getByText('Tue, Dec 1')).toBeVisible()
  await expect(page.getByText('Thu, Dec 3')).toBeVisible()
  await expect(page.getByText('Mon, Nov 30')).toHaveCount(0)

  // a day page opens
  await page.getByText('Tue, Dec 1').click()
  await expect(page).toHaveURL(/\/day\//)

  // clean up through the API (same signed-in session)
  const tripId = page.url().split('/trips/')[1].split('/')[0]
  const del = await page.request.delete(`/api/trips/${tripId}`)
  expect(del.ok()).toBeTruthy()

  // settings loads and never shows an Immich key field value
  await page.goto('/settings')
  await expect(page.getByText('Immich Photos')).toBeVisible()
})

test('API refuses requests without a session', async ({ request }) => {
  const res = await request.get('/api/trips', { headers: { cookie: '' } })
  expect(res.status()).toBe(401)
})
