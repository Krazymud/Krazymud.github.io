import { Box3, Matrix4, Mesh, type Object3D } from 'three'

// 在车模自身坐标里量包围盒；世界坐标的盒子会随转台角度变大，灯位就偏了。
// 车模自带的阴影平面比车身大好几倍，不算在内。
export function carSpaceBox(car: Object3D): Box3 {
  car.updateWorldMatrix(true, true)
  const toCar = car.matrixWorld.clone().invert()
  const box = new Box3()
  const part = new Box3()
  const transform = new Matrix4()
  car.traverse((object) => {
    if (!(object instanceof Mesh) || /shadow/i.test(object.name)) return
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox()
    box.union(part.copy(object.geometry.boundingBox!).applyMatrix4(transform.multiplyMatrices(toCar, object.matrixWorld)))
  })
  return box
}
