'use client'

import React from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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

// Hold back a link that is still arriving, from its `[` onwards, so that it first appears whole:
// `Read [the rep` shows `Read ` until `](url)` has arrived too.
function holdBackIncompleteLink(md: string): string {
    const tail = md.slice(-400)
    const open = tail.lastIndexOf('[')
    if (open < 0) return md
    const rest = tail.slice(open)
    // A finished link, brackets that turned out not to be a link, or a paragraph break since the
    // `[` all mean there is nothing left to wait for.
    if (/^\[[^\]\n]*\]\([^)\n]*\)/.test(rest) || /^\[[^\]\n]*\][^(]/.test(rest) || rest.includes('\n\n')) return md
    return md.slice(0, md.length - tail.length + open)
}

interface LinkSlot {
    key: number
    slot: HTMLElement
    href: string
    text: string
}

export function StreamingMarkdown({
    children,
    onContentShow,
    streaming,
    fade = true,
    fadeDuration,
    skipToEnd = false,
    renderLink,
    openLinksInNewTab = false,
    incompleteLinks = 'text',
    ...rest
}: {
    children: string
    onContentShow?: (content: string) => void
    streaming: boolean
    fade?: boolean
    fadeDuration?: number
    skipToEnd?: boolean
    renderLink?: (href: string, text: string) => React.ReactNode | undefined
    openLinksInNewTab?: boolean
    incompleteLinks?: 'text' | 'hide'
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
    // Whether parser_end has been called on the current parser. Anything written to a parser after
    // its end starts a fresh block (`Jag` shown as `J`, a line break, then `ag`), so text that arrives
    // after the end is re-parsed from a clean slate instead.
    const ended = useRef(false)

    const [slots, setSlots] = useState<LinkSlot[]>([])
    const slotKey = useRef(0)
    const latestRenderLink = useRef(renderLink)
    latestRenderLink.current = renderLink
    const latestNewTab = useRef(openLinksInNewTab)
    latestNewTab.current = openLinksInNewTab

    useEffect(() => {
        function renderer(root: HTMLElement): smd.Default_Renderer {
            const base = smd.default_renderer(root)
            return {
                ...base,
                set_attr: (data, type, value) => {
                    const node = data.nodes[data.index]
                    if (type === smd.HREF && node instanceof HTMLAnchorElement) {
                        const text = node.textContent ?? ''
                        // The link is replaced by an empty element that the caller's React node is
                        // portalled into; it is called again on every render so it stays current.
                        if (latestRenderLink.current?.(value, text) !== undefined) {
                            const slot = document.createElement('span')
                            slot.setAttribute('data-convo-link', '')
                            node.replaceWith(slot)
                            setSlots((current) => [...current, { key: slotKey.current++, slot, href: value, text }])
                            return
                        }
                        smd.default_set_attr(data, type, value)
                        if (latestNewTab.current && /^https?:\/\//.test(value) && !value.startsWith(window.location.origin)) {
                            node.setAttribute('target', '_blank')
                            node.setAttribute('rel', 'noreferrer')
                        }
                        return
                    }
                    smd.default_set_attr(data, type, value)
                }
            }
        }

        function startParser() {
            if (divRef.current) {
                divRef.current.innerHTML = ''
            }
            setSlots((current) => (current.length ? [] : current))
            parser.current = smd.parser(renderer(divRef.current!))
            written.current = ''
            ended.current = false
        }

        function end() {
            if (ended.current) return
            smd.parser_end(parser.current)
            ended.current = true
        }

        // Reveal the first `count` characters of `children`. What is displayed is derived from that
        // prefix every time, so a half-arrived link reads as plain text and turns into a real link
        // once the whole thing is there.
        function reveal(count: number) {
            // An equal count still recomputes: what is visible of the same text changes when streaming ends.
            if (count < shown.current) return
            shown.current = count

            const prefix = children.slice(0, count)
            const visible = incompleteLinks === 'hide' && streaming ? holdBackIncompleteLink(prefix) : cleanTruncatedLink(prefix)
            if (visible === written.current) return
            if (ended.current || !visible.startsWith(written.current)) {
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
                end()
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
                    end()
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
                    end()
                }
                return
            }
            frameId = requestAnimationFrame(append)
        }
        let frameId = requestAnimationFrame(append)
        return () => {
            cancelAnimationFrame(frameId)
        }
    }, [children, streaming, skipToEnd, incompleteLinks])

    const portals = slots.map((slot) => createPortal(<React.Fragment>{renderLink?.(slot.href, slot.text)}</React.Fragment>, slot.slot, slot.key))

    if (fade) {
        return (
            <>
                <FadeContainer ref={divRef} duration={fadeDuration} {...rest} />
                {portals}
            </>
        )
    }

    return (
        <>
            <div ref={divRef} {...rest} />
            {portals}
        </>
    )
}
