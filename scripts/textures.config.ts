import type { TextureJob } from './lib/textures.ts'

export const texturesConfig: TextureJob[] = [
  { name: 'garage_floor_diff', source: 'garage_floor_diff_1k.jpg', size: 1024, quality: 80 },
  { name: 'garage_floor_rough', source: 'garage_floor_rough_1k.jpg', size: 1024, quality: 80 },
  { name: 'garage_floor_nor', source: 'garage_floor_nor_gl_1k.jpg', size: 1024, quality: 80 },
  { name: 'wall_metal_diff', source: 'box_profile_metal_sheet_diff_1k.jpg', size: 1024, quality: 80 },
  { name: 'wall_metal_rough', source: 'box_profile_metal_sheet_rough_1k.jpg', size: 1024, quality: 80 },
  { name: 'wall_metal_nor', source: 'box_profile_metal_sheet_nor_gl_1k.jpg', size: 1024, quality: 80 },
]
