import { describe, expect, it } from 'vitest'
import { wikiKind } from './wikiKind'

describe('wikiKind', () => {
  it.each([
    ['Phoenix Art Museum', 'Art museum in Arizona, US', 'museum'],
    ['Slide Rock State Park', 'State park in Arizona, United States', 'park'],
    ['Bell Rock (Arizona)', 'Landmark near Sedona, Arizona', 'historical'],
    ['Cathedral Rock', 'Landform in Arizona, United States', 'scenic'],
    ['Chapel of the Holy Cross (Sedona, Arizona)', 'Roman Catholic chapel in Sedona, Arizona, US', 'historical'],
    ['Airport Mesa', 'Scenic viewpoint in Sedona, Arizona', 'viewpoint'],
    ['Tlaquepaque (Sedona)', 'Shopping mall in Arizona, U.S.', 'shopping'],
    ['Orpheum Theatre (Phoenix, Arizona)', '1929 historic venue', 'historical'],
    ['Mariposa (restaurant)', 'Restaurant in Arizona, United States', 'food'],
    ['Grand Canyon National Park', 'National park in Arizona, United States', 'national_park'],
  ])('%s → %s', (title, desc, kind) => expect(wikiKind(title, desc)).toBe(kind))

  it.each([
    ['Arizona School for the Arts', 'Public charter school in Phoenix, Arizona, United States'],
    ['BMO Tower (Phoenix)', 'Highrise in Phoenix, Arizona'],
    ['Thomas/Central Avenue station', 'Light rail station in Phoenix, Arizona'],
    ['1990 United States Grand Prix', 'Motor car race'],
    ['Sedona Airport', 'Airport in Yavapai County, Arizona, United States'],
    ['Village of Oak Creek, Arizona', 'Community in Yavapai County, Arizona'],
    ['Sheraton Phoenix Downtown', 'High rise convention hotel'],
    ['Phoenix, Arizona', 'Capital and most populous city of Arizona, U.S.'],
    ['Translational Genomics Research Institute', 'Nonprofit genomics research institute'],
    ['American Museum of Nursing', 'Former museum in Tempe, Arizona'],
    ['Brentwood Historic District', 'Historic district in Arizona, United States'],
  ])('%s is not a place to visit', (title, desc) => expect(wikiKind(title, desc)).toBeNull())
})
