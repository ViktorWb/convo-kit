import React from 'react'
import { describe, expect, it } from 'vitest'
import { advanceMs, renderStreaming } from './helpers'

const chip = (href: string, text: string) =>
    href.startsWith('ref:') ? <b data-testid="chip">{`${text} (${href.slice(4)})`}</b> : undefined

describe('StreamingMarkdown after the parser has ended', () => {
    it('re-parses text that grows after it was shown as finished, instead of breaking the line', async () => {
        const view = renderStreaming({ streaming: false, skipToEnd: true, fade: false, children: 'J' })
        await advanceMs(50)
        expect(view.text).toBe('J')

        await view.stream({ streaming: true, skipToEnd: false, children: 'Jag ser' })
        await advanceMs(2000)
        await view.stream({ streaming: false, skipToEnd: true, children: 'Jag ser ingen fil.' })
        await advanceMs(50)

        expect(view.html).not.toContain('<br')
        expect(view.container.querySelectorAll('p')).toHaveLength(1)
        expect(view.text).toBe('Jag ser ingen fil.')
    })

    it('re-parses a finished message that is replaced by a longer one with the same start', async () => {
        const view = renderStreaming({ streaming: false, skipToEnd: true, fade: false, children: 'First line' })
        await advanceMs(50)
        await view.stream({ streaming: false, skipToEnd: true, children: 'First line, and more' })
        await advanceMs(50)

        expect(view.html).not.toContain('<br')
        expect(view.text).toBe('First line, and more')
    })
})

describe('StreamingMarkdown links', () => {
    it('puts the node renderLink returns in place of the link, and keeps other links as links', async () => {
        const view = renderStreaming({
            streaming: false,
            skipToEnd: true,
            fade: false,
            renderLink: chip,
            children: 'See [Acme](ref:company/1) and [docs](https://example.com).'
        })
        await advanceMs(50)

        expect(view.getByTestId('chip')).toHaveTextContent('Acme (company/1)')
        expect(view.getByTestId('chip').parentElement).toHaveAttribute('data-convo-link')
        const anchors = view.container.querySelectorAll('a')
        expect(anchors).toHaveLength(1)
        expect(anchors[0]).toHaveAttribute('href', 'https://example.com')
        expect(view.text).toBe('See Acme (company/1) and docs.')
    })

    it('renders a link once when the message is re-parsed', async () => {
        const view = renderStreaming({ streaming: false, skipToEnd: true, fade: false, renderLink: chip, children: 'A [x](ref:a)' })
        await advanceMs(50)
        await view.stream({ streaming: false, skipToEnd: true, renderLink: chip, children: 'A [x](ref:a) and more' })
        await advanceMs(50)

        expect(view.getAllByTestId('chip')).toHaveLength(1)
        expect(view.text).toBe('A x (a) and more')
    })

    it('opens outside links in a new tab only when asked', async () => {
        const source = 'Go to [site](https://example.com) or [here](/local).'
        const plain = renderStreaming({ streaming: false, skipToEnd: true, fade: false, children: source })
        await advanceMs(50)
        expect(plain.container.querySelector('a[href="https://example.com"]')).not.toHaveAttribute('target')
        plain.unmount()

        const view = renderStreaming({ streaming: false, skipToEnd: true, fade: false, openLinksInNewTab: true, children: source })
        await advanceMs(50)
        const outside = view.container.querySelector('a[href="https://example.com"]')
        expect(outside).toHaveAttribute('target', '_blank')
        expect(outside).toHaveAttribute('rel', 'noreferrer')
        expect(view.container.querySelector('a[href="/local"]')).not.toHaveAttribute('target')
    })

    it('holds back a link that is still arriving when incompleteLinks is hide', async () => {
        const view = renderStreaming({ streaming: true, skipToEnd: true, fade: false, incompleteLinks: 'hide', children: 'Read [the rep' })
        await advanceMs(50)
        expect(view.shown.at(-1)).toBe('Read ')

        await view.stream({ streaming: true, skipToEnd: true, incompleteLinks: 'hide', children: 'Read [the report](https://x.test) now' })
        await advanceMs(50)
        expect(view.container.querySelector('a')).toHaveTextContent('the report')
        expect(view.shown.at(-1)).toBe('Read [the report](https://x.test) now')
    })

    it.each([
        ['Owed most by [Hamnens', 'Owed most by '],
        ['Owed most by [Hamnens Bygg](ref:books/cus', 'Owed most by '],
        ['Owed most by [Hamnens Bygg]', 'Owed most by '],
        ['Owed most by [Hamnens Bygg](ref:books/customers/1004) and more', 'Owed most by [Hamnens Bygg](ref:books/customers/1004) and more'],
        ['- [x] done', '- [x] done'],
        ['array[0\n\nnext', 'array[0\n\nnext']
    ])('with incompleteLinks hide, streaming %j shows %j', async (source, visible) => {
        const view = renderStreaming({ streaming: true, skipToEnd: true, fade: false, incompleteLinks: 'hide', children: source })
        await advanceMs(50)
        expect(view.shown.at(-1) ?? '').toBe(visible)
    })

    it('shows a link that is still arriving as text by default', async () => {
        const view = renderStreaming({ streaming: true, skipToEnd: true, fade: false, children: 'Read [the rep' })
        await advanceMs(50)
        expect(view.shown.at(-1)).toBe('Read the rep')
    })

    it('shows the text of an unfinished link once the message is done, even when hiding incomplete links', async () => {
        const view = renderStreaming({ streaming: true, skipToEnd: true, fade: false, incompleteLinks: 'hide', children: 'Pick [a' })
        await advanceMs(50)
        await view.stream({ streaming: false, skipToEnd: true, incompleteLinks: 'hide', children: 'Pick [a' })
        await advanceMs(50)
        expect(view.text).toBe('Pick a')
    })
})
