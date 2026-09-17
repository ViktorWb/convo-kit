'use client'

import React from 'react'
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
    // The title may still be empty, so that a bare trailing `[` is held back too.
    const match2 = scanText.match(/([\s\S]*)\[([^\]]*)\]?$/)
    if (match2) {
        const before = match2[1]
        const title = match2[2]
        return `${doNotScanText}${before}${title}`
    }

    return md
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
    const startedWithLength = useRef(children.length)
    const deltas = useRef<{ t: number; delta: string }[]>([])

    // How much of `children` has been revealed, counted against the raw text rather than the
    // link-cleaned text: cleaning changes shape as a link finishes arriving, so an index into it
    // stops meaning the same thing from one render to the next.
    const shown = useRef(0)
    // Exactly what has been handed to the current parser, so a divergence can be detected.
    const written = useRef('')

    const divRef = useRef<HTMLDivElement>(null)

    const parser = useRef<smd.Parser>(null)

    useEffect(() => {
        function startParser() {
            if (divRef.current) {
                divRef.current.innerHTML = ''
            }
            parser.current = smd.parser(smd.default_renderer(divRef.current))
            written.current = ''
        }

        // Reveal the first `count` characters of `children`. What is displayed is derived from that
        // prefix every time, so a half-arrived link reads as plain text and turns into a real link
        // once the whole thing is there.
        function reveal(count: number) {
            if (count <= shown.current) return
            shown.current = count

            const visible = cleanTruncatedLink(children.slice(0, count))
            if (visible === written.current) return
            if (!visible.startsWith(written.current)) {
                // A completed link puts back syntax that was already written out as plain text, and
                // the parser only appends, so the message has to be re-parsed from a clean slate.
                startParser()
            }
            smd.parser_write(parser.current, visible.slice(written.current.length))
            written.current = visible
            onContentShow && onContentShow(visible)
        }

        if (!parser.current) {
            startParser()
        }

        if (skipToEnd) {
            reveal(children.length)
            if (!streaming) {
                smd.parser_end(parser.current)
            }
            return
        }

        const now = performance.now()

        if (children.length > startedWithLength.current) {
            const delta = children.slice(startedWithLength.current + deltas.current.reduce((acc, curr) => acc + curr.delta.length, 0))
            deltas.current.push({ t: now, delta })
        }

        // When the next delta is due, estimated from how far apart the recent ones arrived. The
        // window matters: an assistant message that calls tools spends long stretches producing no
        // text at all, and a rate measured since the message began would average those gaps in and
        // keep the reveal crawling for the rest of the turn, however fast the text then arrives.
        function whenIsNextChunk() {
            const recent = deltas.current.slice(-5)
            // One delta shows no gap, so there is nothing to go on yet.
            if (recent.length < 2) {
                return now + 1000
            }
            const averageGap = (recent[recent.length - 1].t - recent[0].t) / (recent.length - 1)
            return now + averageGap
        }

        const estimateNextChunkAt = whenIsNextChunk()

        let prevTime = now
        const append = (time: DOMHighResTimeStamp) => {
            const deltaTime = time - prevTime
            prevTime = time

            if (time >= estimateNextChunkAt) {
                reveal(children.length)
                if (!streaming) {
                    smd.parser_end(parser.current)
                }
                return
            }

            const charsToGo = children.length - shown.current
            const charsToAdd = Math.min(Math.round((charsToGo / (estimateNextChunkAt - time)) * deltaTime), charsToGo)
            if (charsToAdd > 0) {
                reveal(shown.current + charsToAdd)
            }
            // `>=` rather than `===`: if the message is replaced by a shorter one there is nothing
            // left to reveal, and the loop has to stop rather than spin on every frame forever.
            if (shown.current >= children.length) {
                if (!streaming) {
                    smd.parser_end(parser.current)
                }
                return
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
