// 全局 pinch 缩放标记：ProductCard 的长按/点击会读取它来隔离手势冲突。
// 放在独立文件避免 Collection ↔ ProductCard 循环依赖。
export const pinchingRef = { current: false }
