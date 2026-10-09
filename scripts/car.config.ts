import type { CarConfig } from './lib/carTypes.ts'

export const carConfig: CarConfig = {
  remove: [/^clearcoat_/],
  roles: [
    { role: 'tire', mesh: /^car_wheel_(FL|FR|BL|BR)_car_tire_/ },
    { role: 'wheel', mesh: /^car_wheel_(FL|FR|BL|BR)_car_body_/ },
    { role: 'caliper', mesh: /^car_brake_(FL|FR|BL|BR)_/ },
    { role: 'glass', mesh: /^car_glass_/ },
    { role: 'shadow', mesh: /^car_shadow_/ },
    { role: 'body', mesh: /^car_body_/ },
  ],
  wheels: { FL: 'car_wheel_FL', FR: 'car_wheel_FR', BL: 'car_wheel_BL', BR: 'car_wheel_BR' },
  atlas: {
    diffuse: 'car_body_diffuse',
    specularGlossiness: 'car_body_specularGlossiness',
    occlusion: 'car_body_occlusion',
    paintSpecular: [60, 128, 26],
    paintTolerance: 6,
    plate: { x: 620, y: 290, width: 302, height: 200 },
    plateText: 'WE-456',
    taillights: { x: 2440, y: 1200, width: 1120, height: 300 },
    outputSize: [2048, 1024],
  },
  tireNormal: 'car_tire_normal',
  tireOcclusion: 'car_tire_occlusion',
  shadowTexture: 'car_shadow_diffuse',
  textureMaxSize: 1024,
  targetLength: 4.5,
  maxBytes: 3 * 1024 * 1024,
}
