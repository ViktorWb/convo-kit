# Convo-Kit

Two small, generic React building blocks for LLM chat UIs. Framework/LLM/database agnostic — bring your own chat state (e.g. the Vercel AI SDK's `useChat`); this package is a UI shell only.

```typescript
import { StreamingMarkdown, ScrollBox } from '@viktorw/convo-kit'
```

It contains exactly two components:

- **`StreamingMarkdown`** — a Markdown renderer that understands the "still streaming" state and renders incrementally, with partial-markdown handling and an optional fade-in.
- **`ScrollBox`** — a sticky-to-bottom scroll container for a message list.

## `StreamingMarkdown`

Renders Markdown that is being streamed in. Powered by [`streaming-markdown`](https://github.com/thetarnav/streaming-markdown).

```typescript
// As `text` grows, the Markdown renders incrementally and fades in.
export function AssistantMessage({ text, streaming }: { text: string; streaming: boolean }) {
	return <StreamingMarkdown streaming={streaming}>{text}</StreamingMarkdown>
}
```

- Renders partial Markdown. While a link is still streaming it is shown as plain text and only made clickable once the full link is present.
- Even if the LLM outputs large chunks, the characters are revealed smoothly in much smaller chunks.
- Applies a fade-in effect as content is added quickly.

### Props

In addition to standard `div` props (`className`, `style`, …):

#### `children: string`
The Markdown text to render.

#### `streaming: boolean`
Whether this text is currently streaming. Drives the incremental typewriter reveal; when it flips to `false` the parser is finalized with one clean pass.

#### `skipToEnd?: boolean` (default `false`)
Render the content fully and immediately, skipping the typewriter animation. Set `true` for any message that is not the latest so old messages appear in their final form.

#### `fade?: boolean` (default `true`)
Whether to apply a fade effect as content is added quickly.

#### `fadeDuration?: number` (default `500`)
Fade duration in milliseconds.

#### `onContentShow?: (content: string) => void`
Called as more content is revealed, with the text shown so far.

## `ScrollBox`

A scroll container that sticks to the bottom as new content is added. If the user scrolls up it holds that position; when the user scrolls back to the bottom, auto-stick re-engages.

```typescript
<ScrollBox
	maxHeight="100%"
	renderContent={(isAtBottom, scrollToBottom) => (
		<div>
			{messages.map((m) => (
				<Message key={m.id} message={m} />
			))}
			{/* optionally show a "jump to latest" button when !isAtBottom */}
		</div>
	)}
/>
```

### Props

In addition to standard `div` props (`className`, `style`, …):

#### `renderContent: (isAtBottom: boolean, scrollToBottom: () => void) => React.ReactNode`
Render-prop for the scrollable content (instead of `children`, so the component can re-measure on its own terms). Receives whether the view is currently pinned to the bottom and a function to scroll to the bottom.

#### `maxHeight?: string | number`
Caps the container height and enables internal scrolling. If omitted, the document is used as the scroll container.

#### `springConfig?: { damping?: number; stiffness?: number; mass?: number }`
Tunes the spring animation used for smooth auto-scroll.
