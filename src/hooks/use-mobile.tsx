import * as React from "react"

const MOBILE_BREAKPOINT = 1024

let cachedMql: MediaQueryList | null = null

function getMql(): MediaQueryList | null {
  if (typeof window === "undefined") return null
  if (!cachedMql) {
    cachedMql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  }
  return cachedMql
}

function subscribe(callback: () => void) {
  const mql = getMql()
  if (!mql) return () => {}
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

function getSnapshot() {
  const mql = getMql()
  return mql ? mql.matches : false
}

function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
