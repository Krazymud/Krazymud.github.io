import { Effect } from 'postprocessing'
import { Uniform, Vector3 } from 'three'

// 暗部偏冷、高光偏暖，加一点对比；数值在浏览器里对着画面调。
// 这里拿到的是色调映射前的线性颜色，车库又很暗：色调只能乘不能加（加一点就会把黑色抬成灰雾），
// 对比度绕中灰做幂曲线，不截断大于 1 的高光。
export const GRADE = {
  shadowTint: [0.94, 0.98, 1.08] as [number, number, number],
  highlightTint: [1.06, 1.0, 0.93] as [number, number, number],
  contrast: 0.12,
  saturation: 1.05,
}

export type GradeOptions = Partial<typeof GRADE>

const fragmentShader = /* glsl */ `
uniform vec3 shadowTint;
uniform vec3 highlightTint;
uniform float contrast;
uniform float saturation;

const float MID_GREY = 0.18;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 color = max(inputColor.rgb, 0.0);
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = max(mix(vec3(luma), color, saturation), 0.0);
  color *= mix(shadowTint, highlightTint, smoothstep(0.02, 0.5, luma));
  color = MID_GREY * pow(color / MID_GREY, vec3(1.0 + contrast));
  outputColor = vec4(color, inputColor.a);
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
