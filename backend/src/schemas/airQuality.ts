import { z } from 'zod'

export const RegionSchema = z.object({
  id:        z.string(),
  name:      z.string(),
  shortName: z.string(),
  city:      z.string(),
  lat:       z.number(),
  lng:       z.number(),
})

export const SearchQuerySchema = z.object({
  q: z.string().min(1, '검색어를 입력해 주세요.'),
})

export const CoordsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
})

export const RegionIdParamSchema = z.object({
  regionId: z.string().min(1),
})
