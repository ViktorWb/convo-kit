import React from 'react'
import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StreamingMarkdown } from '../src/markdown'
import { FRAME_MS, advanceFrames, advanceMs, renderStreaming } from './helpers'

const LOREM = 'The quick brown fox jumps over the lazy dog, then turns around and does the whole thing again, backwards. '

describe('StreamingMarkdown', () => {
    describe('container and props', () => {
        it('forwards standard div props to the container', () => {
            vi.useFakeTimers()
            const { container } = render(
                <StreamingMarkdown streaming={false} id="answer" data-testid="md" title="hi">
                    {'hello'}
                </StreamingMarkdown>
            )

            const div = container.firstElementChild as HTMLElement
            expect(div.tagName).toBe('DIV')
            expect(div.id).toBe('answer')
            expect(div).toHaveAttribute('data-testid', 'md')
            expect(div).toHaveAttribute('title', 'hi')
        })

        it('wraps the content in the fade container by default', () => {
            vi.useFakeTimers()
            const { container } = render(<StreamingMarkdown streaming={false}>{'hello'}</StreamingMarkdown>)

            const div = container.firstElementChild as HTMLElement
            expect(div.className).toContain('fadecontainer')
            expect(div.style.getPropertyValue('--convo-kit-llm-fade-start')).toBe('0')
            expect(div.style.getPropertyValue('--convo-kit-llm-fade-end')).toBe('0')
        })

        it('renders a bare div when fade is disabled', () => {
            vi.useFakeTimers()
            const { container } = render(
                <StreamingMarkdown streaming={false} fade={false}>
                    {'hello'}
                </StreamingMarkdown>
            )

            const div = container.firstElementChild as HTMLElement
            expect(div.className).toBe('')
            expect(div.style.getPropertyValue('--convo-kit-llm-fade-start')).toBe('')
        })

        it('uses fadeDuration for the mask transition', () => {
            vi.useFakeTimers()
            const { container } = render(
                <StreamingMarkdown streaming={false} fadeDuration={120}>
                    {'hello'}
                </StreamingMarkdown>
            )

            expect((container.firstElementChild as HTMLElement).style.transition).toContain('120ms')
        })

        it('merges a caller style with the fade custom properties', () => {
            vi.useFakeTimers()
            const { container } = render(
                <StreamingMarkdown streaming={false} style={{ color: 'rgb(255, 0, 0)' }}>
                    {'hello'}
                </StreamingMarkdown>
            )

            const div = container.firstElementChild as HTMLElement
            expect(div.style.color).toBe('rgb(255, 0, 0)')
            expect(div.style.getPropertyValue('--convo-kit-llm-fade-start')).toBe('0')
        })

        it('merges a caller className with the fade container class', () => {
            vi.useFakeTimers()
            const { container } = render(
                <StreamingMarkdown streaming={false} className="prose">
                    {'hello'}
                </StreamingMarkdown>
            )

            const div = container.firstElementChild as HTMLElement
            // The module class is hashed by the CSS pipeline, so match it loosely.
            expect(div.className).toContain('fadecontainer')
            expect(div).toHaveClass('prose')
        })

        it('keeps the caller className when the fade is disabled', () => {
            vi.useFakeTimers()
            const { container } = render(
                <StreamingMarkdown streaming={false} fade={false} className="prose">
                    {'hello'}
                </StreamingMarkdown>
            )

            expect((container.firstElementChild as HTMLElement).className).toBe('prose')
        })
    })

    describe('incremental reveal', () => {
        const markdown = LOREM.repeat(3)

        it('renders nothing before the first animation frame', () => {
            const view = renderStreaming({ streaming: true, children: markdown })

            expect(view.text).toBe('')
            expect(view.shown).toHaveLength(0)
        })

        it('reveals only a small slice on the first frame rather than the whole chunk', async () => {
            const view = renderStreaming({ streaming: true, children: markdown })

            await advanceFrames(1)

            expect(view.revealed).toBeGreaterThan(0)
            // Paced over the default 1s estimate, one 16ms frame is ~1.6% of the text.
            expect(view.revealed).toBeLessThan(markdown.length * 0.1)
        })

        it('reveals characters in growing prefixes of the source text', async () => {
            const view = renderStreaming({ streaming: true, children: markdown })

            await advanceFrames(20)

            expect(view.shown.length).toBeGreaterThan(5)
            for (const content of view.shown) {
                expect(markdown.startsWith(content)).toBe(true)
            }
            for (let i = 1; i < view.shown.length; i++) {
                expect(view.shown[i].length).toBeGreaterThan(view.shown[i - 1].length)
            }
        })

        it('reveals roughly linearly across the estimated window', async () => {
            const view = renderStreaming({ streaming: true, children: markdown })

            await advanceMs(500)

            const fraction = view.revealed / markdown.length
            expect(fraction).toBeGreaterThan(0.3)
            expect(fraction).toBeLessThan(0.7)
        })

        it('has revealed everything once the default 1s estimate elapses', async () => {
            const view = renderStreaming({ streaming: true, children: markdown })

            await advanceMs(1000 + FRAME_MS)

            expect(view.revealed).toBe(markdown.length)
            expect(view.text).toContain('The quick brown fox')
        })

        it('parses markdown into real elements as it is revealed', async () => {
            const view = renderStreaming({
                streaming: true,
                children: `# Title\n\n${LOREM}\n\n- one\n- two\n`
            })

            await advanceFrames(6)
            expect(view.container.querySelector('h1')).toHaveTextContent('Title')
            expect(view.container.querySelector('ul')).toBeNull()

            await advanceMs(1000 + FRAME_MS)
            expect(view.container.querySelector('p')).not.toBeNull()
            expect(view.container.querySelectorAll('ul li')).toHaveLength(2)
        })

        it('keeps one parser across re-renders instead of restarting the document', async () => {
            const view = renderStreaming({ streaming: true, children: '# Title\n\nfirst' })
            await advanceMs(1000 + FRAME_MS)

            await view.stream({ children: '# Title\n\nfirst and second', streaming: false })
            await advanceMs(1000 + FRAME_MS)

            expect(view.container.querySelectorAll('h1')).toHaveLength(1)
            expect(view.text).toBe('Titlefirst and second')
        })
    })

    describe('pacing from recent deltas', () => {
        it('paces a single delta over the 1s fallback estimate', async () => {
            const view = renderStreaming({ streaming: true, children: 'start' })
            await advanceMs(1000 + FRAME_MS)

            const next = 'start' + 'x'.repeat(1000)
            await view.stream({ children: next })
            await advanceMs(200)

            // Only one delta so far: no gap to measure, so the fallback 1s window applies.
            expect(view.revealed).toBeLessThan(next.length)

            await advanceMs(900)
            expect(view.revealed).toBe(next.length)
        })

        it('speeds the reveal up when deltas arrive quickly', async () => {
            let text = 'start'
            const view = renderStreaming({ streaming: true, children: text })
            await advanceMs(1000 + FRAME_MS)

            // Two deltas 50ms apart set the expected gap to 50ms.
            text += 'x'.repeat(200)
            await view.stream({ children: text })
            await advanceMs(50)
            text += 'x'.repeat(200)
            await view.stream({ children: text })

            await advanceMs(50 + FRAME_MS)
            expect(view.revealed).toBe(text.length)
        })

        it('slows the reveal down when deltas arrive slowly', async () => {
            let text = 'start'
            const view = renderStreaming({ streaming: true, children: text })
            await advanceMs(1000 + FRAME_MS)

            text += 'x'.repeat(200)
            await view.stream({ children: text })
            await advanceMs(1000)
            text += 'x'.repeat(200)
            await view.stream({ children: text })

            await advanceMs(50 + FRAME_MS)
            expect(view.revealed).toBeLessThan(text.length)

            await advanceMs(1000)
            expect(view.revealed).toBe(text.length)
        })

        it('ignores an old stall and paces from the last five deltas only', async () => {
            // Regression guard: a tool call early in the turn leaves a long silent gap. Averaging
            // since the message began would keep the reveal crawling once text starts flowing.
            let text = 'start'
            const view = renderStreaming({ streaming: true, children: text })

            text += 'x'.repeat(100)
            await view.stream({ children: text })
            await advanceMs(5000)
            expect(view.revealed).toBe(text.length)

            for (let i = 0; i < 5; i++) {
                text += 'x'.repeat(200)
                await view.stream({ children: text })
                await advanceMs(50)
            }

            // Six deltas recorded; the recent five span 50ms each, so the tail flushes fast.
            await advanceMs(50 + FRAME_MS)
            expect(view.revealed).toBe(text.length)
        })

        it('flushes the remainder in one go once the next chunk is overdue', async () => {
            let text = 'start'
            const view = renderStreaming({ streaming: true, children: text })
            await advanceMs(1000 + FRAME_MS)

            text += 'x'.repeat(50)
            await view.stream({ children: text })
            await advanceMs(20)
            text += 'x'.repeat(5000)
            await view.stream({ children: text })

            const before = view.shown.length
            await advanceMs(20 + FRAME_MS)

            expect(view.revealed).toBe(text.length)
            // The overdue branch writes everything left in a single pass.
            expect(view.shown.length - before).toBeLessThan(5)
        })
    })

    describe('finalization', () => {
        it('leaves trailing text pending while still streaming', async () => {
            const view = renderStreaming({ streaming: true, children: 'A sentence that ends here.' })

            await advanceMs(1000 + FRAME_MS)

            expect(view.revealed).toBe('A sentence that ends here.'.length)
            // smd holds the final character back until the parser is ended.
            expect(view.text).not.toContain('here.')
        })

        it('flushes pending text when streaming flips to false', async () => {
            const view = renderStreaming({ streaming: true, children: 'A sentence that ends here.' })
            await advanceMs(1000 + FRAME_MS)

            await view.setStreaming(false)
            await advanceFrames(1)

            expect(view.text).toBe('A sentence that ends here.')
        })

        it('finalizes a message that was never streaming', async () => {
            const view = renderStreaming({ streaming: false, children: 'Done already.' })

            await advanceMs(1000 + FRAME_MS)

            expect(view.text).toBe('Done already.')
        })
    })

    describe('skipToEnd', () => {
        it('renders everything on mount without waiting for a frame', () => {
            const view = renderStreaming({ streaming: false, skipToEnd: true, children: '# Title\n\nBody text.' })

            expect(view.revealed).toBe('# Title\n\nBody text.'.length)
            expect(view.container.querySelector('h1')).toHaveTextContent('Title')
            expect(view.text).toContain('Body text.')
        })

        it('reports the whole source to onContentShow in one call', () => {
            const view = renderStreaming({ streaming: false, skipToEnd: true, children: 'Body text.' })

            expect(view.shown).toEqual(['Body text.'])
        })

        it('appends only the new tail when more content arrives', async () => {
            const view = renderStreaming({ streaming: true, skipToEnd: true, children: '# Title\n\nfirst' })

            await view.stream({ children: '# Title\n\nfirst and second', streaming: false })

            expect(view.container.querySelectorAll('h1')).toHaveLength(1)
            expect(view.text).toBe('Titlefirst and second')
        })

        it('does nothing when re-rendered with unchanged content', async () => {
            const view = renderStreaming({ streaming: false, skipToEnd: true, children: 'Body text.' })

            await view.stream({ children: 'Body text.' })

            expect(view.shown).toHaveLength(1)
            expect(view.text).toBe('Body text.')
        })

        it('finalizes when streaming flips to false after everything was written', async () => {
            const view = renderStreaming({ streaming: true, skipToEnd: true, children: 'A sentence.' })
            expect(view.text).toBe('A sentence')

            await view.setStreaming(false)
            await advanceFrames(2)

            expect(view.text).toBe('A sentence.')
        })

        it('does not schedule animation frames', async () => {
            const view = renderStreaming({ streaming: false, skipToEnd: true, children: LOREM })
            const before = view.shown.length

            await advanceFrames(100)

            expect(view.shown).toHaveLength(before)
        })
    })

    describe('truncated links', () => {
        const renderFinal = (children: string) => {
            const view = renderStreaming({ streaming: false, skipToEnd: true, children })
            return view
        }

        it('renders a half-streamed link target as plain text', () => {
            const view = renderFinal('Read the [documentation](https://exa')

            expect(view.container.querySelector('a')).toBeNull()
            expect(view.text).toBe('Read the documentation')
        })

        it('renders a link whose title is still streaming as plain text', () => {
            const view = renderFinal('Read the [documentat')

            expect(view.container.querySelector('a')).toBeNull()
            expect(view.text).toBe('Read the documentat')
        })

        it('renders a closed title with no target yet as plain text', () => {
            const view = renderFinal('Read the [documentation]')

            expect(view.container.querySelector('a')).toBeNull()
            expect(view.text).toBe('Read the documentation')
        })

        it('keeps a complete link at the end of the text clickable', () => {
            const view = renderFinal('Read the [documentation](https://example.com)')

            const link = view.container.querySelector('a')
            expect(link).toHaveAttribute('href', 'https://example.com')
            expect(link).toHaveTextContent('documentation')
        })

        it('keeps a complete link followed by more text clickable', () => {
            const view = renderFinal('Read the [documentation](https://example.com) for more.')

            expect(view.container.querySelector('a')).toHaveAttribute('href', 'https://example.com')
        })

        it('leaves links further back than the 100 character scan window alone', () => {
            const view = renderFinal(`Read the [documentation](https://example.com) and then ${LOREM.repeat(2)}`)

            expect(view.container.querySelector('a')).toHaveAttribute('href', 'https://example.com')
        })

        it('leaves text without brackets untouched', () => {
            const view = renderFinal('Just a plain sentence.')

            expect(view.text).toBe('Just a plain sentence.')
        })

        it('leaves a bracketed aside in the middle of a line untouched', () => {
            const view = renderFinal('An aside [like this] inside a sentence.')

            // The cleaner only trims a bracket run at the very end, so nothing after the aside is
            // dropped. smd itself renders the reference-style brackets away.
            expect(view.text).toBe('An aside like this inside a sentence.')
        })

        it('hides the link while its target streams in', async () => {
            const full = 'Read the [documentation](https://example.com) now.'
            const view = renderStreaming({ streaming: true, children: full.slice(0, 20) })
            await advanceMs(1000 + FRAME_MS)
            expect(view.container.querySelector('a')).toBeNull()

            await view.stream({ children: full.slice(0, 40) })
            await advanceMs(1000 + FRAME_MS)
            expect(view.container.querySelector('a')).toBeNull()
        })

        it('keeps the surrounding text intact when a link resolves', async () => {
            const full = 'Before [docs](https://example.com) after, and a tail sentence.'
            const view = renderStreaming({ streaming: true, children: full.slice(0, 20) })
            await advanceMs(1000 + FRAME_MS)

            await view.stream({ children: full, streaming: false })
            await advanceMs(1000 + FRAME_MS)

            expect(view.text).toBe('Before docs after, and a tail sentence.')
            expect(view.container.querySelectorAll('p')).toHaveLength(1)
        })

        it('resolves several links in the same message', async () => {
            const full = 'See [one](https://one.example) and [two](https://two.example) for details.'
            const view = renderStreaming({ streaming: true, children: full.slice(0, 12) })

            for (const end of [25, 40, 55, full.length]) {
                await advanceMs(1000 + FRAME_MS)
                await view.stream({ children: full.slice(0, end), streaming: end !== full.length })
            }
            await advanceMs(1000 + FRAME_MS)

            const links = Array.from(view.container.querySelectorAll('a'))
            expect(links.map((a) => a.getAttribute('href'))).toEqual(['https://one.example', 'https://two.example'])
            expect(view.text).toBe('See one and two for details.')
        })

        it('still reports growing prefixes while a link resolves', async () => {
            const full = 'Read the [documentation](https://example.com) now.'
            const view = renderStreaming({ streaming: true, children: full.slice(0, 20) })
            await advanceMs(1000 + FRAME_MS)
            await view.stream({ children: full, streaming: false })
            await advanceMs(1000 + FRAME_MS)

            for (let i = 1; i < view.shown.length; i++) {
                expect(view.shown[i].length).toBeGreaterThan(view.shown[i - 1].length)
            }
            expect(view.shown.at(-1)).toBe(full)
        })

        it('resolves a link that arrives with skipToEnd set', async () => {
            const full = 'Read the [documentation](https://example.com) now.'
            const view = renderStreaming({ streaming: true, skipToEnd: true, children: full.slice(0, 20) })
            expect(view.container.querySelector('a')).toBeNull()

            await view.stream({ children: full, streaming: false })

            expect(view.container.querySelector('a')).toHaveAttribute('href', 'https://example.com')
            expect(view.text).toBe('Read the documentation now.')
        })

        it('makes the link clickable once it has fully streamed in', async () => {
            const full = 'Read the [documentation](https://example.com) now.'
            const view = renderStreaming({ streaming: true, children: full.slice(0, 20) })
            await advanceMs(1000 + FRAME_MS)
            await view.stream({ children: full.slice(0, 40) })
            await advanceMs(1000 + FRAME_MS)

            await view.stream({ children: full, streaming: false })
            await advanceMs(1000 + FRAME_MS)

            expect(view.container.querySelector('a')).toHaveAttribute('href', 'https://example.com')
            expect(view.text).toBe('Read the documentation now.')
        })

    })

    describe('lifecycle and edge cases', () => {
        it('stops revealing after unmount', async () => {
            const view = renderStreaming({ streaming: true, children: LOREM.repeat(3) })
            await advanceFrames(3)
            const atUnmount = view.shown.length

            view.unmount()
            await advanceFrames(100)

            expect(view.shown).toHaveLength(atUnmount)
        })

        it('handles empty content without rendering or crashing', async () => {
            const view = renderStreaming({ streaming: true, children: '' })

            await advanceMs(2000)

            expect(view.text).toBe('')
            expect(view.shown).toHaveLength(0)
        })

        it('handles content that shrinks without writing garbage', async () => {
            const view = renderStreaming({ streaming: true, children: 'The full sentence.' })
            await advanceMs(1000 + FRAME_MS)

            await view.stream({ children: 'The full' })
            await advanceFrames(20)

            expect(view.text).toBe('The full sentence')
        })

        it('survives content arriving one character at a time', async () => {
            const full = '# Title\n\nHello world.'
            const view = renderStreaming({ streaming: true, children: '' })

            for (let i = 1; i <= full.length; i++) {
                await view.stream({ children: full.slice(0, i) })
                await advanceMs(10)
            }
            await view.stream({ children: full, streaming: false })
            await advanceMs(1000)

            expect(view.container.querySelector('h1')).toHaveTextContent('Title')
            expect(view.text).toBe('TitleHello world.')
        })

        it('works without an onContentShow callback', async () => {
            vi.useFakeTimers()
            const { container } = render(<StreamingMarkdown streaming={false}>{'Plain text.'}</StreamingMarkdown>)

            await act(async () => {
                vi.advanceTimersByTime(1000 + FRAME_MS)
            })

            expect(container.textContent).toBe('Plain text.')
        })
    })
})
