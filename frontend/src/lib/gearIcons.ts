import { Shirt, Glasses, Footprints, Droplets, Wind, ShieldAlert, type LucideIcon } from 'lucide-react'
import type { GearItem } from './getGearRecommendation'

const REGISTRY: Record<GearItem['icon'], LucideIcon> = {
  shirt: Shirt,
  glasses: Glasses,
  footprints: Footprints,
  droplets: Droplets,
  wind: Wind,
  shield: ShieldAlert,
}

export function gearIconFor(icon: GearItem['icon']): LucideIcon {
  return REGISTRY[icon]
}
