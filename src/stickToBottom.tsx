import React, { ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from 'react'

type SpringConfig = {
    damping?: number
    stiffness?: number
    mass?: number
}

const DEFAULT_SPRING: Required<SpringConfig> = {
    damping: 0.7,
    stiffness: 0.1,
    mass: 1.25
}

function useSpringScroll(getScrollTop: () => number, setScrollTop: (v: number) => void, isSelecting: () => boolean, config: SpringConfig = {}) {
    const merged = { ...DEFAULT_SPRING, ...config }

    const startedRef = useRef(false)
    const [target, setTarget] = useState<{ scroll: number; calculatedAt: number } | null>(null)

    const velocity = useRef(0)
    useEffect(() => {
        if (target === null) {
            return
        }

        let lastTime = performance.now()

        const tick = (time: number) => {
            if (isSelecting()) {
                velocity.current = 0
                rafId = null
                return
            }

            const dt = (time - lastTime) / (1000 / 60)
            lastTime = time

            const current = getScrollTop()
            const diff = target.scroll - current

            // stop condition
            if (Math.abs(diff) < 0.5 && Math.abs(velocity.current) < 0.5) {
                setScrollTop(target.scroll)

                velocity.current = 0
                rafId = null
                return
            }

            velocity.current = (merged.damping * velocity.current + merged.stiffness * diff) / merged.mass

            if (current + velocity.current * dt > current) {
                setScrollTop(current + velocity.current * dt)
            }

            rafId = requestAnimationFrame(tick)
        }

        let rafId = requestAnimationFrame(tick)

        return () => {
            if (typeof rafId === 'number') {
                cancelAnimationFrame(rafId)
            }
        }
    }, [target, getScrollTop, setScrollTop, merged.damping, merged.mass, merged.stiffness])

    return {
        scrollTo: useCallback((target: number) => {
            startedRef.current = true
            setTarget({ scroll: target, calculatedAt: Date.now() })
        }, []),
        stop: useCallback(() => {
            startedRef.current = false
            setTarget(null)
        }, [])
    }
}

let mouseDown = false

globalThis.document?.addEventListener('mousedown', () => {
    mouseDown = true
})

globalThis.document?.addEventListener('mouseup', () => {
    mouseDown = false
})

globalThis.document?.addEventListener('click', () => {
    mouseDown = false
})

export function StickyBox(
    props: {
        scrollContainer?: () => HTMLElement
        renderContent: (isAtBottom: boolean, scrollToBottom: () => void) => React.ReactNode
        springConfig?: SpringConfig
    } & Omit<ComponentProps<'div'>, 'children'>
) {
    const { scrollContainer, renderContent, ...rest } = props

    const divRef = useRef<HTMLDivElement>(null)

    const [stateIsAtBottom, setStateIsAtBottom] = useState(false)

    const ignoreScrollTop = useRef(0)
    const isAtBottom = useRef(false)
    const resizeDifference = useRef(0)

    const updateIsAtBottom = (v: boolean) => {
        isAtBottom.current = v
        setStateIsAtBottom(v)
    }

    const isSelecting = useCallback(() => {
        if (!mouseDown) {
            return false
        }

        const selection = window.getSelection()
        if (!selection || !selection.rangeCount) {
            return false
        }

        const range = selection.getRangeAt(0)
        return range.commonAncestorContainer.contains(divRef.current) || divRef.current?.contains(range.commonAncestorContainer)
    }, [props.scrollContainer])

    const chatUiBottom = useCallback(() => {
        const chatUiRect = divRef.current.getBoundingClientRect()
        return chatUiRect.bottom + window.scrollY
    }, [])

    const containerBottom = useCallback(() => {
        if (props.scrollContainer) {
            const container = props.scrollContainer()
            if (!container) {
                return 0
            }
            const containerRect = container.getBoundingClientRect()
            return containerRect.bottom + window.scrollY
        } else {
            return document.documentElement.clientHeight + window.scrollY
        }
    }, [props.scrollContainer])

    const scrollTop = useCallback(() => {
        if (props.scrollContainer) {
            return props.scrollContainer()?.scrollTop ?? 0
        }
        return window.scrollY
    }, [props.scrollContainer])

    const setScrollTop = useCallback(
        (v: number) => {
            v = Math.round(v)
            if (props.scrollContainer) {
                const container = props.scrollContainer()
                if (!container) {
                    return
                }
                v = Math.min(v, container.scrollHeight - container.clientHeight)
                ignoreScrollTop.current = v
                container.scrollTo(0, v)
            } else {
                v = Math.min(v, document.documentElement.scrollHeight - document.documentElement.clientHeight)
                ignoreScrollTop.current = v
                window.scrollTo(0, v)
            }
        },
        [props.scrollContainer]
    )

    const scrollDifference = useCallback(() => {
        if (props.scrollContainer && !props.scrollContainer()) {
            return 0
        }
        return chatUiBottom() - containerBottom()
    }, [props.scrollContainer, chatUiBottom, containerBottom])

    const targetScrollTop = useCallback(() => {
        const container = props.scrollContainer ? props.scrollContainer() : document.documentElement
        if (!container) {
            return 0
        }
        return container.scrollTop + scrollDifference()
    }, [props.scrollContainer, scrollDifference])

    const isNearBottom = useCallback(() => {
        if (props.scrollContainer && !props.scrollContainer()) {
            return false
        }
        return scrollDifference() <= 70
    }, [scrollDifference])

    const springScroll = useSpringScroll(scrollTop, setScrollTop, isSelecting, props.springConfig)

    useEffect(() => {
        const timeout = setTimeout(() => {
            if (isNearBottom()) {
                updateIsAtBottom(true)
                springScroll.scrollTo(targetScrollTop())
            }
        }, 500)
        return () => {
            clearTimeout(timeout)
        }
    }, [])

    useEffect(() => {
        let cancelled = false
        let lastScrollTop = null
        const cb = () => {
            const _scrollTop = scrollTop()
            const _ignoreScrollTop = ignoreScrollTop.current
            let _lastScrollTop = lastScrollTop === null ? _scrollTop : lastScrollTop

            lastScrollTop = _scrollTop
            ignoreScrollTop.current = undefined

            if (_ignoreScrollTop && _ignoreScrollTop > _scrollTop) {
                /**
                 * When the user scrolls up while the animation plays, the `scrollTop` may
                 * not come in separate events; if this happens, to make sure `isScrollingUp`
                 * is correct, set the lastScrollTop to the ignored event.
                 */
                _lastScrollTop = _ignoreScrollTop
            }

            const isScrollingUp = _scrollTop < _lastScrollTop - 2

            /**
             * Scroll events may come before a ResizeObserver event,
             * so in order to ignore resize events correctly we use a
             * timeout.
             *
             * @see https://github.com/WICG/resize-observer/issues/25#issuecomment-248757228
             */
            setTimeout(() => {
                if (cancelled) {
                    return
                }

                /**
                 * When theres a resize difference ignore the resize event.
                 */
                if (resizeDifference.current || _scrollTop === _ignoreScrollTop) {
                    return
                }

                if (isSelecting()) {
                    updateIsAtBottom(false)
                    springScroll.stop()
                    return
                }

                if (isScrollingUp) {
                    updateIsAtBottom(false)
                    springScroll.stop()
                    return
                }

                if (isNearBottom()) {
                    updateIsAtBottom(true)
                }
            }, 1)
        }
        cb()
        const container = props.scrollContainer ? props.scrollContainer() : document
        if (!container) {
            return
        }
        container.addEventListener('scroll', cb, { passive: true })
        return () => {
            container.removeEventListener('scroll', cb)
            cancelled = true
        }
    }, [props.scrollContainer, springScroll.stop])

    useEffect(() => {
        const cb = (ev: WheelEvent) => {
            if (ev.deltaY < 0) {
                springScroll.stop()
            }
        }
        const container = props.scrollContainer ? props.scrollContainer() : document
        if (!container) {
            return
        }
        container.addEventListener('wheel', cb, { passive: true })
        return () => {
            container.removeEventListener('wheel', cb)
        }
    }, [springScroll.stop])

    useEffect(() => {
        let previousHeight: number | undefined

        const observer = new ResizeObserver(([entry]) => {
            const { height } = entry.contentRect
            const difference = height - (previousHeight ?? height)

            resizeDifference.current = difference

            if (difference < 0) {
                /**
                 * If it's a negative resize, check if we're near the bottom if
                 * we are want to un-escape from the lock, because the resize
                 * could have caused the container to be at the bottom.
                 */
                if (isNearBottom()) {
                    updateIsAtBottom(true)
                }
            }

            if (isAtBottom.current) {
                springScroll.scrollTo(targetScrollTop())
            }

            previousHeight = height

            /**
             * Reset the resize difference after the scroll event
             * has fired. Requires a rAF to wait for the scroll event,
             * and a setTimeout to wait for the other timeout we have in
             * resizeObserver in case the scroll event happens after the
             * resize event.
             */
            requestAnimationFrame(() => {
                setTimeout(() => {
                    if (resizeDifference.current === difference) {
                        resizeDifference.current = 0
                    }
                }, 1)
            })
        })
        observer.observe(divRef.current)
        return () => {
            observer.disconnect()
        }
    }, [springScroll.scrollTo, targetScrollTop, isNearBottom, setScrollTop, scrollTop])

    return (
        <div ref={divRef} {...rest}>
            {props.renderContent(stateIsAtBottom, () => {
                springScroll.scrollTo(targetScrollTop())
            })}
        </div>
    )
}

function ScrollBoxInner(props: Pick<React.ComponentProps<typeof ScrollBox>, 'maxHeight' | 'renderContent'>) {
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    return (
        <div
            ref={scrollContainerRef}
            style={{ maxHeight: props.maxHeight, overflow: typeof props.maxHeight === 'string' || typeof props.maxHeight === 'number' ? 'auto' : undefined }}
        >
            <StickyBox scrollContainer={() => scrollContainerRef.current} renderContent={props.renderContent} />
        </div>
    )
}

export function ScrollBox(props: Omit<React.ComponentProps<typeof StickyBox>, 'scrollContainer'> & { maxHeight?: string | number }) {
    const { renderContent, maxHeight, ...rest } = props

    const outerRenderContent = useCallback(() => {
        return <ScrollBoxInner maxHeight={props.maxHeight} renderContent={props.renderContent} />
    }, [props.renderContent, props.maxHeight])

    return <StickyBox renderContent={outerRenderContent} {...rest}></StickyBox>
}
