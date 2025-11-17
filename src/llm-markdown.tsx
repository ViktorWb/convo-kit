'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Markdown } from './markdown'
import * as styles from '../css/llm-markdown.module.css'

/**
 * React component that renders streaming markdown output.
 *
 * See [llm-ui docs](https://llm-ui.com/docs/llm-output-hook) and [react markdown docs](https://github.com/remarkjs/react-markdown?tab=readme-ov-file#options) for info on props.
 */
export function LlmMarkdown(
    props: {
        throttleFunction?: (deltaTimeMs: number, shown: number, full: number) => { addChars: number }
        onContentShow?: (text: string) => void
        /**
         * Whether or not a fade-in effect should be added.
         */
        fade?: boolean
    } & React.ComponentProps<typeof Markdown>
) {
    let { children, fade, onContentShow, throttleFunction, ...rest } = props
    if (!throttleFunction) {
        throttleFunction = (deltaTimeMs, shown, full) => ({
            addChars: Math.max(((full - shown) / 700) * deltaTimeMs, (50 * deltaTimeMs) / 1000)
        })
    }

    const [show, setShow] = useState(children.length)
    let showContent = children.slice(0, show)

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
    showContent = cleanTruncatedLink(showContent)

    useEffect(() => {
        let interval: any
        const iterate = () => {
            setShow((old) => {
                if (old === children.length) {
                    clearInterval(interval)
                    return old
                }
                return Math.min(old + Math.max(Math.floor(throttleFunction(100, old, children.length).addChars), 0), children.length)
            })
        }
        interval = setInterval(iterate, 100)
        iterate()
        return () => {
            clearInterval(interval)
        }
    }, [children])

    const ref = useRef<HTMLDivElement>(null)

    useLayoutEffect(() => {
        if (onContentShow) {
            onContentShow(showContent)
        }
    }, [showContent])

    useEffect(() => {
        ref.current.style.setProperty('--convo-kit-llm-fade-start', `${ref.current.clientHeight + 16}`)
        ref.current.style.setProperty('--convo-kit-llm-fade-end', `${ref.current.clientHeight + 16}`)
    }, [showContent])

    return (
        <div
            ref={ref}
            className={fade === false ? undefined : (styles as any).fadecontainer}
            style={
                {
                    '--convo-kit-llm-fade-start': 0,
                    '--convo-kit-llm-fade-end': 0,
                    transition: '--convo-kit-llm-fade-start 500ms cubic-bezier(0,0,1,1), --convo-kit-llm-fade-end 500ms cubic-bezier(0,0.5,0.5,1)'
                } as React.CSSProperties
            }
        >
            <Markdown {...rest}>{showContent}</Markdown>
        </div>
    )
}
