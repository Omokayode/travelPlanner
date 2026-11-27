// "Plan by cities": pick a route, build the days, create the trip. Uses the real OpenStreetMap
// services through the app (place search, nearby places) — if those are busy the draft still has
// the city stops and says so.
import { expect, test } from '@playwright/test'

const password = process.env.E2E_PASSWORD || ''
test.use({ timezoneId: 'America/Chicago', locale: 'en-US' })
test.skip(!password, 'E2E_PASSWORD not set')
test.setTimeout(180_000)

async function pickCity(page: import('@playwright/test').Page, box: import('@playwright/test').Locator, query: string) {
  await box.fill(query)
  const option = page.getByRole('button', { name: new RegExp(query.split(',')[0]) }).first()
  await option.waitFor({ timeout: 20_000 })
  await option.click()
}

test('plan by cities: route → days with places → trip', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/$/)

  await page.goto('/trips/new')
  await page.getByRole('button', { name: /Plan by cities/ }).click()
  await page.getByLabel('Trip name').fill('E2E planned trip')
  await page.getByLabel('Start date').fill('2026-12-18')
  await pickCity(page, page.getByPlaceholder('Where do you start? (city)'), 'Milwaukee, Wisconsin')
  await pickCity(page, page.getByPlaceholder('City you sleep in'), 'Chicago, Illinois')
  await expect(page.getByText('2 nights → 3 days')).toBeVisible()

  await page.getByRole('button', { name: /Build the days/ }).click()
  await expect(page.getByRole('heading', { name: 'E2E planned trip' })).toBeVisible({ timeout: 120_000 })
  await expect(page.getByText('Milwaukee → Chicago')).toBeVisible()
  await expect(page.getByText('Day in Chicago')).toBeVisible()
  await expect(page.getByText('Chicago → Milwaukee')).toBeVisible()

  await page.getByRole('button', { name: 'Create trip' }).click()
  await expect(page).toHaveURL(/\/trips\/[^/#]+$/, { timeout: 120_000 })
  await expect(page.getByRole('heading', { name: 'Friday, December 18th' })).toBeVisible()
  const tripId = page.url().split('/trips/')[1]
  const trip = await (await page.request.get(`/api/trips/${tripId}`)).json()
  expect(trip.days).toHaveLength(3)
  // day 1 drives Milwaukee → Chicago (worked out on create)
  expect(trip.days[0].places[1].name).toMatch(/Chicago/)
  expect(trip.days[0].places[1].travel.distance).toBeGreaterThan(60)
  expect(trip.days[2].places.at(-1).name).toMatch(/Milwaukee/)
  await page.request.delete(`/api/trips/${tripId}`)
})
