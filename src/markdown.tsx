'use client'

import React, { useMemo } from 'react'
import { useEffect, useRef } from 'react'
import * as smd from 'streaming-markdown'
import { FadeContainer } from './fadeContainer'

const components = {
    ...Object.fromEntries(
        Array.from(new Array(6)).map((_, i) => {
            return [
                `h${i + 1}`,
                (props2: React.PropsWithChildren<{ style?: React.CSSProperties }>) => {
                    const props3 = props2 as typeof props2 & { isFirst?: boolean; isPartOfList?: boolean }
                    const Component = (components && components[`h${i + 1}`]) || `h${i + 1}`
                    return (
                        <Component
                            style={{
                                margin: `${props3.isFirst || props3.isPartOfList ? 0 : '0.75em'} 0 0 0`,
                                whiteSpace: 'pre-wrap',
                                overflowWrap: 'anywhere',
                                display: props3.isPartOfList ? 'inline' : undefined
                            }}
                        >
                            {props3.children}
                        </Component>
                    )
                }
            ]
        })
    ),
    p: (props2) => {
        const props3 = props2 as typeof props2 & { isFirst?: boolean; isPartOfList?: boolean }
        const Component = components?.p || 'p'
        return (
            <Component
                style={{
                    margin: `${props3.isFirst || props3.isPartOfList ? 0 : '0.75em'} 0 0 0`,
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                    display: props3.isPartOfList ? 'inline' : undefined
                }}
            >
                {props3.children}
            </Component>
        )
    },
    ul: (props2) => {
        const Component = components?.ul || 'ul'
        return <Component style={{ paddingInlineStart: '1.3em' }}>{props2.children}</Component>
    },
    ol: (props2) => {
        const Component = components?.ol || 'ol'
        return <Component style={{ paddingInlineStart: '1.3em' }}>{props2.children}</Component>
    }
}

export function StreamingMarkdown({
    children,
    onContentShow,
    streaming,
    fade = true,
    fadeDuration,
    skipToEnd = false,
    ...rest
}: {
    children: string
    onContentShow?: (content: string) => void
    streaming: boolean
    fade?: boolean
    fadeDuration?: number
    skipToEnd?: boolean
} & Omit<React.ComponentProps<'div'>, 'children'>) {
    // Convert [This is a link](https://go -> This is a link
    // and [This is a link -> This is a link
    // because streamdown doesn't handle this ATM
    function cleanTruncatedLink(md: string): string {
        let doNotScanText = md.slice(0, -100)
        let scanText = md.slice(-100)

        // Regex: <before text>[title](href
        const match = scanText.match(/([\s\S]*)\[([^\]]+)\]\([^\)]*$/)
        if (match) {
            const before = match[1]
            const title = match[2]
            return `${doNotScanText}${before}${title}`
        }

        // Regex: <before text>[title
        // Or: <before text>[title]
        const match2 = scanText.match(/([\s\S]*)\[([^\]]+)\]?$/)
        if (match2) {
            const before = match2[1]
            const title = match2[2]
            return `${doNotScanText}${before}${title}`
        }

        return md
    }
    children = useMemo(() => cleanTruncatedLink(children), [children])

    const t0 = useRef(performance.now())
    const startedWithLength = useRef(children.length)
    const deltas = useRef<{ t: number; delta: string }[]>([])

    const shown = useRef(0)
    const divRef = useRef<HTMLDivElement>(null)

    const parser = useRef<smd.Parser>(null)

    useEffect(() => {
        if (!parser.current) {
            const renderer = smd.default_renderer(divRef.current)
            parser.current = smd.parser(renderer)
        }
        if (skipToEnd) {
            if (shown.current < children.length) {
                smd.parser_write(parser.current, children.slice(shown.current))
                shown.current = children.length
                onContentShow && onContentShow(children.slice(0, shown.current))
            }
            return
        }

        const now = performance.now()

        if (children.length > startedWithLength.current) {
            const delta = children.slice(startedWithLength.current + deltas.current.reduce((acc, curr) => acc + curr.delta.length, 0))
            deltas.current.push({ t: performance.now(), delta })
        }

        function whenIsNextChunk() {
            if (deltas.current.length === 0) {
                return now + 1000
            }
            const avgChunkSize = deltas.current.slice(-5).reduce((acc, curr) => acc + curr.delta.length, 0) / Math.min(deltas.current.length, 5)
            const avgCharsPerMs = (children.length - startedWithLength.current) / (now - t0.current)
            return now + avgChunkSize / avgCharsPerMs
        }

        const estimateNextChunkAt = whenIsNextChunk()

        let prevTime = now
        const append = (time: DOMHighResTimeStamp) => {
            const deltaTime = time - prevTime
            prevTime = time

            if (time >= estimateNextChunkAt) {
                smd.parser_write(parser.current, children.slice(shown.current, children.length))
                shown.current = children.length
                onContentShow && onContentShow(children)
                if (!streaming) {
                    smd.parser_end(parser.current)
                }
                return
            }

            const charsToGo = children.length - shown.current
            const charsToAdd = Math.min(Math.round((charsToGo / (estimateNextChunkAt - time)) * deltaTime), children.length - shown.current)
            if (charsToAdd > 0) {
                smd.parser_write(parser.current, children.slice(shown.current, shown.current + charsToAdd))
                shown.current += charsToAdd
                onContentShow && onContentShow(children.slice(0, shown.current))
                if (shown.current === children.length) {
                    if (!streaming) {
                        smd.parser_end(parser.current)
                    }
                    return
                }
            }
            frameId = requestAnimationFrame(append)
        }
        let frameId = requestAnimationFrame(append)
        return () => {
            cancelAnimationFrame(frameId)
        }
    }, [children, streaming, skipToEnd])

    if (fade) {
        return <FadeContainer ref={divRef} duration={fadeDuration} {...rest} />
    }

    return <div ref={divRef} {...rest} />
}
