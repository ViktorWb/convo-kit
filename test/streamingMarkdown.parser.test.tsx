import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as smd from 'streaming-markdown'
import { StreamingMarkdown } from '../src/markdown'
import { FRAME_MS, advanceFrames, advanceMs } from './helpers'

// Wrap the real parser so behaviour is unchanged but every call is observable.
vi.mock('streaming-markdown', async (importOriginal) => {
    const actual = await importOriginal<typeof import('streaming-markdown')>()
    return {
        ...actual,
        default_renderer: vi.fn(actual.default_renderer),
        parser: vi.fn(actual.parser),
        parser_write: vi.fn(actual.parser_write),
        parser_end: vi.fn(actual.parser_end)
    }
})

const writes = () => vi.mocked(smd.parser_write).mock.calls.map(([, chunk]) => chunk)
const written = () => writes().join('')
/** Chunks written after a given invocation order, used to inspect a restarted parser's stream. */
const writesSince = (order: number) => writes().filter((_, i) => vi.mocked(smd.parser_write).mock.invocationCallOrder[i] > order)

describe('StreamingMarkdown parser usage', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    it('creates exactly one parser and renderer for the lifetime of the component', async () => {
        const { rerender } = render(<StreamingMarkdown streaming={true}>{'one'}</StreamingMarkdown>)
        await advanceFrames(5)
        await act(async () => {
            rerender(<StreamingMarkdown streaming={true}>{'one two'}</StreamingMarkdown>)
        })
        await advanceFrames(5)
        await act(async () => {
            rerender(<StreamingMarkdown streaming={false}>{'one two three'}</StreamingMarkdown>)
        })
        await advanceMs(2000)

        expect(smd.parser).toHaveBeenCalledTimes(1)
        expect(smd.default_renderer).toHaveBeenCalledTimes(1)
    })

    it('mounts the renderer on the component container', async () => {
        const { container } = render(
            <StreamingMarkdown streaming={false} data-testid="md">
                {'text'}
            </StreamingMarkdown>
        )
        await advanceFrames(1)

        expect(smd.default_renderer).toHaveBeenCalledWith(container.firstElementChild)
    })

    it('writes contiguous, non-overlapping slices that reassemble the source', async () => {
        const source = 'Paragraph one.\n\n## Heading\n\n- alpha\n- beta\n\nAnd a closing paragraph.'
        render(<StreamingMarkdown streaming={false}>{source}</StreamingMarkdown>)

        await advanceMs(1000 + FRAME_MS)

        expect(writes().length).toBeGreaterThan(5)
        expect(written()).toBe(source)
    })

    it('reassembles the source across several streamed deltas', async () => {
        const parts = ['# Report\n\n', 'First finding. ', 'Second finding. ', 'Third finding.']
        let text = parts[0]
        const { rerender } = render(<StreamingMarkdown streaming={true}>{text}</StreamingMarkdown>)

        for (const part of parts.slice(1)) {
            await advanceMs(40)
            text += part
            await act(async () => {
                rerender(<StreamingMarkdown streaming={true}>{text}</StreamingMarkdown>)
            })
        }
        await act(async () => {
            rerender(<StreamingMarkdown streaming={false}>{text}</StreamingMarkdown>)
        })
        await advanceMs(2000)

        expect(written()).toBe(text)
    })

    it('never ends the parser while streaming', async () => {
        render(<StreamingMarkdown streaming={true}>{'Some text.'}</StreamingMarkdown>)

        await advanceMs(5000)

        expect(written()).toBe('Some text.')
        expect(smd.parser_end).not.toHaveBeenCalled()
    })

    it('never ends the parser when the overdue branch flushes the remainder mid-stream', async () => {
        // The catch-up path writes everything left in one call; it must still respect `streaming`.
        let text = 'start'
        const { rerender } = render(<StreamingMarkdown streaming={true}>{text}</StreamingMarkdown>)
        await advanceMs(1000 + FRAME_MS)

        text += 'x'.repeat(50)
        await act(async () => {
            rerender(<StreamingMarkdown streaming={true}>{text}</StreamingMarkdown>)
        })
        await advanceMs(20)
        text += 'x'.repeat(5000)
        await act(async () => {
            rerender(<StreamingMarkdown streaming={true}>{text}</StreamingMarkdown>)
        })
        await advanceMs(20 + FRAME_MS)

        expect(written()).toBe(text)
        expect(smd.parser_end).not.toHaveBeenCalled()
    })

    it('ends the parser once everything is written and streaming is over', async () => {
        const { rerender } = render(<StreamingMarkdown streaming={true}>{'Some text.'}</StreamingMarkdown>)
        await advanceMs(1000 + FRAME_MS)
        expect(smd.parser_end).not.toHaveBeenCalled()

        await act(async () => {
            rerender(<StreamingMarkdown streaming={false}>{'Some text.'}</StreamingMarkdown>)
        })
        await advanceFrames(1)

        expect(smd.parser_end).toHaveBeenCalled()
        expect(vi.mocked(smd.parser_end).mock.invocationCallOrder[0]).toBeGreaterThan(
            vi.mocked(smd.parser_write).mock.invocationCallOrder.at(-1)!
        )
    })

    it('rebuilds the parser exactly once when a truncated link resolves', async () => {
        const full = 'Read the [documentation](https://example.com) now.'
        const { container, rerender } = render(<StreamingMarkdown streaming={true}>{full.slice(0, 20)}</StreamingMarkdown>)
        await advanceMs(1000 + FRAME_MS)
        expect(smd.parser).toHaveBeenCalledTimes(1)

        await act(async () => {
            rerender(<StreamingMarkdown streaming={false}>{full}</StreamingMarkdown>)
        })
        await advanceMs(1000 + FRAME_MS)

        // Cleaning put the link syntax back, so the append-only stream had to be restarted.
        expect(smd.parser).toHaveBeenCalledTimes(2)
        expect(smd.default_renderer).toHaveBeenLastCalledWith(container.firstElementChild)
        // The restarted parser is fed the whole message, not just the tail.
        expect(writesSince(vi.mocked(smd.parser).mock.invocationCallOrder[1]).join('')).toBe(full)
        expect(container.querySelectorAll('a')).toHaveLength(1)
    })

    it('does not rebuild the parser for content without links', async () => {
        const { rerender } = render(<StreamingMarkdown streaming={true}>{'Plain text so far'}</StreamingMarkdown>)
        await advanceMs(1000 + FRAME_MS)
        await act(async () => {
            rerender(<StreamingMarkdown streaming={false}>{'Plain text so far, and more of it.'}</StreamingMarkdown>)
        })
        await advanceMs(1000 + FRAME_MS)

        expect(smd.parser).toHaveBeenCalledTimes(1)
    })

    it('stops the frame loop when the message is replaced by a shorter one', async () => {
        const { rerender } = render(<StreamingMarkdown streaming={true}>{'The full sentence.'}</StreamingMarkdown>)
        await advanceMs(1000 + FRAME_MS)
        const before = writes().length

        await act(async () => {
            rerender(<StreamingMarkdown streaming={true}>{'The full'}</StreamingMarkdown>)
        })
        await advanceMs(5000)

        // Nothing left to reveal: no writes, no parser restart, and the loop bails out.
        expect(writes()).toHaveLength(before)
        expect(smd.parser).toHaveBeenCalledTimes(1)
    })

    it('keeps what was rendered when a shorter message replaces it under skipToEnd', async () => {
        const { container, rerender } = render(
            <StreamingMarkdown streaming={false} skipToEnd={true}>
                {'The full sentence.'}
            </StreamingMarkdown>
        )
        const before = writes().length

        await act(async () => {
            rerender(
                <StreamingMarkdown streaming={false} skipToEnd={true}>
                    {'The full'}
                </StreamingMarkdown>
            )
        })

        expect(writes()).toHaveLength(before)
        expect(smd.parser).toHaveBeenCalledTimes(1)
        expect(container.textContent).toBe('The full sentence.')
    })

    it('keeps what was rendered when a shorter message arrives during a fast stream', async () => {
        // Deltas closer together than a frame put the loop straight into the overdue branch, which
        // is the one path that would otherwise try to reveal backwards.
        let text = 'The full sentence.'
        const { container, rerender } = render(<StreamingMarkdown streaming={true}>{text}</StreamingMarkdown>)
        await advanceMs(1000 + FRAME_MS)
        for (const part of [' One.', ' Two.']) {
            text += part
            await act(async () => {
                rerender(<StreamingMarkdown streaming={true}>{text}</StreamingMarkdown>)
            })
            await advanceMs(5)
        }
        await advanceMs(1000)
        const before = writes().length

        await act(async () => {
            rerender(<StreamingMarkdown streaming={true}>{'The full'}</StreamingMarkdown>)
        })
        await advanceMs(1000)

        expect(writes()).toHaveLength(before)
        expect(smd.parser).toHaveBeenCalledTimes(1)
        expect(container.textContent).toContain('The full sentence. One. Two')
    })

    it('stops writing after unmount', async () => {
        const { unmount } = render(<StreamingMarkdown streaming={true}>{'x'.repeat(500)}</StreamingMarkdown>)
        await advanceFrames(3)
        const before = writes().length
        expect(before).toBeGreaterThan(0)

        unmount()
        await advanceMs(5000)

        expect(writes()).toHaveLength(before)
        expect(smd.parser_end).not.toHaveBeenCalled()
    })

    describe('skipToEnd', () => {
        it('writes the whole source in a single call on mount', () => {
            const source = '# Title\n\nBody text.'
            render(
                <StreamingMarkdown streaming={false} skipToEnd={true}>
                    {source}
                </StreamingMarkdown>
            )

            expect(writes()).toEqual([source])
            expect(smd.parser_end).toHaveBeenCalledTimes(1)
        })

        it('writes only the new tail on each update', async () => {
            const { rerender } = render(
                <StreamingMarkdown streaming={true} skipToEnd={true}>
                    {'abc'}
                </StreamingMarkdown>
            )
            await act(async () => {
                rerender(
                    <StreamingMarkdown streaming={true} skipToEnd={true}>
                        {'abcdef'}
                    </StreamingMarkdown>
                )
            })

            expect(writes()).toEqual(['abc', 'def'])
            expect(smd.parser_end).not.toHaveBeenCalled()
        })

        it('does not write again when re-rendered with unchanged content', async () => {
            const { rerender } = render(
                <StreamingMarkdown streaming={true} skipToEnd={true}>
                    {'abc'}
                </StreamingMarkdown>
            )
            await act(async () => {
                rerender(
                    <StreamingMarkdown streaming={true} skipToEnd={true} className="changed">
                        {'abc'}
                    </StreamingMarkdown>
                )
            })

            expect(writes()).toEqual(['abc'])
        })

        it('schedules no animation frames', async () => {
            render(
                <StreamingMarkdown streaming={false} skipToEnd={true}>
                    {'x'.repeat(500)}
                </StreamingMarkdown>
            )
            const before = writes().length

            await advanceMs(5000)

            expect(writes()).toHaveLength(before)
        })
    })
})
