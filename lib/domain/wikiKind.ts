// lib/domain/wikiKind.ts — what kind of place a Wikipedia article near a city is, from its short
// description ("Art museum in Arizona", "Public high school in …"); null = not a place to visit.
import type { PlaceCategory } from '@/lib/types'

// not somewhere to go as a visitor
const SKIP =
  /\b(school|college|university|campus|academy|station|stop|light rail|high-?rise|skyscraper|office|tower|headquarters|corporate|company|business|hotel|motel|resort|apartment|lofts?|condominium|residential|neighbou?rhood|community|unincorporated|populated place|census|county|city in|town in|village in|suburb|municipality|election|race|grand prix|festival|convention|conference|tournament|season|team|club\b|league|hospital|medical|clinic|prison|jail|court\b|government|city hall|agency|department|newspaper|radio|television|tv station|airport|airline|highway|interstate|freeway|road|street|avenue|route|railway|railroad|bus|parking|power plant|dam\b|water tower|cemetery|funeral|police|fire station|library|post office|church\b|parish|diocese|synagogue|mosque|temple\b|record label|album|song|film|novel|book|person|politician|research|institute|laborator|foundation|organi[sz]ation|nonprofit|charity|association|society|former|defunct|demolished|historic district|canal)/
const CHECKS: [RegExp, PlaceCategory][] = [
  [/national park|national monument|national recreation area|national preserve/, 'national_park'],
  [/museum|gallery/, 'museum'],
  [/botanical garden|garden|state park|park\b|forest|wilderness|preserve|protected area|nature reserve|trail\b|recreation area/, 'park'],
  [/viewpoint|overlook|scenic/, 'viewpoint'],
  [/historic|national register|united states historic place|memorial|monument|mission|fort\b|castle|landmark|lighthouse|ruins|archaeological|plaza|square|bridge|chapel|cathedral|basilica|historic church/, 'historical'],
  [/\b(mountain|summit|peak|butte|mesa|canyon|gorge|rock|landform|natural feature|formation|lake|river|waterfall|falls|springs?|sinkhole|cave|beach|island|desert|valley|arch)\b/, 'scenic'],
  [/zoo|aquarium|observatory|amusement|theme park|water park|planetarium|science center/, 'attraction'],
  [/theat(er|re)|opera|concert hall|performing arts|music venue|arena|stadium|ballpark/, 'attraction'],
  [/shopping|mall|market|outlet/, 'shopping'],
  [/restaurant|diner|bakery|brewery|winery|café|cafe|coffee/, 'food'],
  [/art installation|sculpture|statue|mural|public art/, 'attraction'],
]

export function wikiKind(title: string, description = ''): PlaceCategory | null {
  const d = description.toLowerCase()
  const t = title.toLowerCase()
  // historic churches/chapels/cathedrals are sights even though "church" is skipped otherwise
  const sacredSight = /historic church|chapel|cathedral|basilica|mission/.test(d) || /chapel|cathedral|basilica|mission/.test(t)
  if (!sacredSight && (SKIP.test(d) || (!d && SKIP.test(t)))) return null
  for (const [re, kind] of CHECKS) if (re.test(d)) return kind
  for (const [re, kind] of CHECKS) if (re.test(t)) return kind
  return null
}
