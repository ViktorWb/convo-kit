'use client'

import React, { useEffect, useRef } from 'react'
import * as styles from '../css/fade-container.module.css'

export function FadeContainer({ children, duration = 500, style, ref, ...rest }: React.ComponentProps<'div'> & { duration?: number }) {
    if (typeof duration !== 'number') {
        duration = 500
    }

    const localRef = useRef<HTMLDivElement>(null)

    const resolvedRef =
        typeof ref === 'function'
            ? (node: HTMLDivElement | null) => {
                  localRef.current = node
                  ref(node)
              }
            : ref
            ? {
                  get current() {
                      return ref.current
                  },
                  set current(node) {
                      localRef.current = node
                      ref.current = node
                  }
              }
            : localRef

    useEffect(() => {
        const el = localRef.current
        if (!el) return

        const observer = new ResizeObserver(() => {
            el.style.setProperty('--convo-kit-llm-fade-start', `${el.clientHeight + 16}`)
            el.style.setProperty('--convo-kit-llm-fade-end', `${el.clientHeight + 16}`)
        })
        observer.observe(el)
        return () => {
            observer.disconnect()
        }
    }, [])

    return (
        <div
            ref={resolvedRef}
            className={(styles as any).fadecontainer}
            style={
                {
                    '--convo-kit-llm-fade-start': 0,
                    '--convo-kit-llm-fade-end': 0,
                    transition: `--convo-kit-llm-fade-start ${duration}ms cubic-bezier(0,0,1,1), --convo-kit-llm-fade-end ${duration}ms cubic-bezier(0,0.5,0.5,1)`,
                    ...(style || {})
                } as React.CSSProperties
            }
            {...rest}
        >
            {children}
        </div>
    )
}
