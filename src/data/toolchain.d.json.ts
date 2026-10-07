// 为同步产物 toolchain.json 声明类型（tsconfig 已开启 allowArbitraryExtensions）
import type { Toolchain } from "../types.ts";

declare const data: Toolchain;
export default data;
