import { Effect } from 'postprocessing'
import { Uniform, Vector3 } from 'three'

// 暗部偏冷、高光偏暖，加一点 S 形对比；数值在浏览器里对着画面调。
export const GRADE = {
  shadowTint: [-0.012, 0.0, 0.02] as [number, number, number],
  highlightTint: [0.03, 0.012, -0.015] as [number, number, number],
  contrast: 0.25,
  saturation: 1.05,
}

export type GradeOptions = Partial<typeof GRADE>

const fragmentShader = /* glsl */ `
uniform vec3 shadowTint;
uniform vec3 highlightTint;
uniform float contrast;
uniform float saturation;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 color = max(inputColor.rgb, 0.0);
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luma), color, saturation);
  color += shadowTint * (1.0 - smoothstep(0.0, 0.4, luma)) + highlightTint * smoothstep(0.4, 1.0, luma);
  vec3 clamped = clamp(color, 0.0, 1.0);
  color = mix(color, clamped * clamped * (3.0 - 2.0 * clamped), contrast);
  outputColor = vec4(max(color, 0.0), inputColor.a);
}
`

export class GradeEffect extends Effect {
  constructor(options: GradeOptions = {}) {
    const look = { ...GRADE, ...options }
    super('GradeEffect', fragmentShader, {
      uniforms: new Map<string, Uniform>([
        ['shadowTint', new Uniform(new Vector3(...look.shadowTint))],
        ['highlightTint', new Uniform(new Vector3(...look.highlightTint))],
        ['contrast', new Uniform(look.contrast)],
        ['saturation', new Uniform(look.saturation)],
      ]),
    })
  }
}
