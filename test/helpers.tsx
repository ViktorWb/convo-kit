import React from 'react'
import { act, render } from '@testing-library/react'
import { vi } from 'vitest'
import { StreamingMarkdown } from '../src/markdown'

/** jsdom's faked rAF (via sinon) fires one callback per 16ms tick. */
export const FRAME_MS = 16

export async function advanceMs(ms: number) {
    await act(async () => {
        vi.advanceTimersByTime(ms)
    })
}

export async function advanceFrames(count: number) {
    await advanceMs(FRAME_MS * count)
}

type Props = React.ComponentProps<typeof StreamingMarkdown>

/**
 * Renders StreamingMarkdown with fake timers already installed, and exposes a `stream` helper that
 * pushes a new `children` value the way a token stream would.
 */
export function renderStreaming(props: Props) {
    vi.useFakeTimers()
    const shown: string[] = []
    const onContentShow = (content: string) => {
        shown.push(content)
        props.onContentShow?.(content)
    }

    const utils = render(<StreamingMarkdown {...props} onContentShow={onContentShow} />)

    return {
        ...utils,
        /** Every value `onContentShow` has been called with, oldest first. */
        shown,
        get text() {
            return utils.container.textContent ?? ''
        },
        get html() {
            return utils.container.innerHTML
        },
        /** The number of characters revealed so far, as reported by `onContentShow`. */
        get revealed() {
            return shown.at(-1)?.length ?? 0
        },
        async stream(next: Partial<Props> & { children: string }) {
            await act(async () => {
                utils.rerender(<StreamingMarkdown {...props} {...next} onContentShow={onContentShow} />)
            })
        },
        async setStreaming(streaming: boolean) {
            await act(async () => {
                utils.rerender(<StreamingMarkdown {...props} streaming={streaming} onContentShow={onContentShow} />)
            })
        }
    }
}
