// 两页式滚动：第一屏（页头）和第二屏（筛选 + 结果）之间整页切换，不停在两屏之间。
// 第二屏内部正常滚动；向上滚到第二屏顶部时停住，下一次向上的手势才回到第一屏。

/** 两次滚轮事件间隔超过这个值，视为新的手势（用来吞掉触控板惯性） */
const GESTURE_GAP = 200;
/** 触摸滑动超过这个距离才翻页 */
const SWIPE = 40;
/** 停止滚动多久算滚动结束 */
const SETTLE = 120;

/** 这些区域有自己的滚动或交互，不参与翻页 */
const OWN_SCROLL = ".detail";
const INTERACTIVE = "input, textarea, select, button, a, label, [contenteditable], .detail";

/** 翻页动画进行中：目标位置和开始时间 */
let animating = false;
let animTarget = 0;
let animStart = 0;
/** 动画超过这个时长仍未到达目标（被打断或卡住），视为结束 */
const ANIM_TIMEOUT = 1500;
let settleTimer = 0;

// 一次滚轮手势（连续的滚轮事件，含触控板惯性）的状态
let lastWheel = -Infinity;
/** 本次手势已经翻页或撞到第二屏顶部，剩余事件全部吞掉 */
let locked = false;
/** 本次手势从第二屏开始：向上越过第二屏顶部时要停住 */
let fromSecond = false;
/** 本次手势从第二屏顶部开始：向上才翻回第一屏 */
let fromWall = false;

function secondTop(): number {
  const screen = document.getElementById("filter");
  return screen ? Math.round(screen.getBoundingClientRect().top + scrollY) : 0;
}

function within(target: EventTarget | null, selector: string): boolean {
  return target instanceof Element && target.closest(selector) !== null;
}

/** 翻到第一屏（0）或第二屏（1） */
export function goToPage(page: 0 | 1) {
  fromSecond = false;
  const top = page === 0 ? 0 : secondTop();
  if (Math.abs(scrollY - top) < 1) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    scrollTo(0, top);
    return;
  }
  animating = true;
  animTarget = top;
  animStart = performance.now();
  scrollTo({ top, behavior: "smooth" });
}

/** 滚动停下后：结束翻页动画；如果停在两屏之间，对齐到更近的一屏 */
function settle() {
  // 翻页动画中途可能因掉帧暂时没有滚动事件，不能当作已停下
  if (animating && performance.now() - animStart < ANIM_TIMEOUT) {
    settleTimer = window.setTimeout(settle, SETTLE);
    return;
  }
  animating = false;
  const top = secondTop();
  if (scrollY > 1 && scrollY < top - 1) goToPage(scrollY > top / 2 ? 1 : 0);
}

/** 停在第二屏顶部，并结束本次手势 */
function stopAtWall(top: number) {
  locked = true;
  scrollTo(0, top);
}

function onScroll() {
  if (animating && Math.abs(scrollY - animTarget) < 1) animating = false;
  clearTimeout(settleTimer);
  settleTimer = window.setTimeout(settle, SETTLE);
  // 浏览器的滚轮平滑滚动会累积多格位移，事件里来不及拦，越过第二屏顶部时在这里拉回
  const top = secondTop();
  const inGesture = performance.now() - lastWheel < GESTURE_GAP * 2;
  if (!animating && inGesture && fromSecond && scrollY < top - 1) stopAtWall(top);
}

function wheelPixels(event: WheelEvent): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * 16;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * innerHeight;
  return event.deltaY;
}

function onWheel(event: WheelEvent) {
  if (event.ctrlKey || event.deltaY === 0 || within(event.target, OWN_SCROLL)) return;
  const top = secondTop();
  const now = event.timeStamp; // 用输入发生的时间判断手势，主线程繁忙时处理时刻会滞后
  if (now - lastWheel > GESTURE_GAP) {
    locked = false;
    fromSecond = scrollY >= top - 1;
    fromWall = Math.abs(scrollY - top) <= 1;
  }
  lastWheel = now;

  if (animating || locked) {
    event.preventDefault();
    return;
  }
  const down = event.deltaY > 0;
  // 第一屏：任何滚动都整页切换
  if (scrollY < top - 1) {
    event.preventDefault();
    if (fromSecond && !down) stopAtWall(top);
    else {
      locked = true;
      goToPage(down ? 1 : 0);
    }
    return;
  }
  if (down) return;
  // 第二屏顶部向上：只有从顶部开始的手势才翻回第一屏，滚上来撞到顶部的只停住
  if (scrollY <= top + 1) {
    event.preventDefault();
    if (fromWall) {
      locked = true;
      goToPage(0);
    } else stopAtWall(top);
    return;
  }
  // 第二屏内向上：这一格会越过顶部时直接停在顶部
  if (scrollY + wheelPixels(event) < top) {
    event.preventDefault();
    stopAtWall(top);
  }
}

function onKey(event: KeyboardEvent) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  if (within(event.target, INTERACTIVE)) return;
  const space = event.key === " ";
  const down = event.key === "ArrowDown" || event.key === "PageDown" || (space && !event.shiftKey);
  const up = event.key === "ArrowUp" || event.key === "PageUp" || (space && event.shiftKey);
  if (!down && !up) return;

  const top = secondTop();
  if (scrollY < top - 1) {
    event.preventDefault();
    goToPage(down ? 1 : 0);
  } else if (up && scrollY <= top + 1) {
    event.preventDefault();
    goToPage(0);
  } else if (up && scrollY - (event.key === "ArrowUp" ? 40 : innerHeight * 0.875) < top) {
    // 这次按键会越过第二屏顶部：只滚到顶部
    event.preventDefault();
    goToPage(1);
  }
}

let touchY = 0;
let touchScroll = 0;

function onTouchStart(event: TouchEvent) {
  touchY = event.touches[0].clientY;
  touchScroll = scrollY;
}

function onTouchMove(event: TouchEvent) {
  if (event.touches.length > 1 || within(event.target, OWN_SCROLL)) return;
  const top = secondTop();
  const pullDown = event.touches[0].clientY > touchY; // 手指下滑 = 页面向上
  // 第一屏、或在第二屏顶部往回拉时，不让页面跟手滚动，松手后整页切换
  if (touchScroll < top - 1 || (touchScroll <= top + 1 && pullDown)) event.preventDefault();
}

function onTouchEnd(event: TouchEvent) {
  if (within(event.target, OWN_SCROLL)) return;
  const dy = touchY - event.changedTouches[0].clientY; // > 0：手指上滑 = 页面向下
  const top = secondTop();
  if (touchScroll < top - 1 && Math.abs(dy) > SWIPE) goToPage(dy > 0 ? 1 : 0);
  else if (touchScroll <= top + 1 && dy < -SWIPE) goToPage(0);
}

/** 安装两页式滚动，返回卸载函数 */
export function installPaging(): () => void {
  const passive = { passive: true } as const;
  const active = { passive: false } as const;
  addEventListener("wheel", onWheel, active);
  addEventListener("keydown", onKey);
  addEventListener("touchstart", onTouchStart, passive);
  addEventListener("touchmove", onTouchMove, active);
  addEventListener("touchend", onTouchEnd, passive);
  addEventListener("scroll", onScroll, passive);
  addEventListener("resize", onScroll, passive);
  return () => {
    removeEventListener("wheel", onWheel);
    removeEventListener("keydown", onKey);
    removeEventListener("touchstart", onTouchStart);
    removeEventListener("touchmove", onTouchMove);
    removeEventListener("touchend", onTouchEnd);
    removeEventListener("scroll", onScroll);
    removeEventListener("resize", onScroll);
    clearTimeout(settleTimer);
  };
}
