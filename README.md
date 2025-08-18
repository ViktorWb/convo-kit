# Convo-Kit

Build an LLM chat UI in React. 100% generic over LLM, database and UI styling.

This kit contains:

- `LlmMarkdown` component, supporting streaming Markdown with partial markdown handling and fade-in effect.
- `ChatUi` component that renders chat messages and handles scroll behavior as new messages are added.
- Frontend/Backend HTTP with support for streaming and storing chat history in any database.
- `renderMessagesToText` function that renders the chat message conversation as text and plain HTML. Useful for example when saving chat conversations to file or when including the conversation in an email.
- `ChatMessageDisplay` component that displays a chat message and its related info such as timestamp. This is useful for building back-office dashboards where chat conversations are visualized.

## LlmMarkdown: Streaming Markdown

The `LlmMarkdown` component renders markdown and supports streaming.

It is powered by [Streamdown](https://github.com/vercel/streamdown) (which in turn is powered by [react-markdown](https://github.com/remarkjs/react-markdown), and supports the same props.

### Usage

```typescript
// As `text` gets generated the markdown will fade-in
export function AssistantMessage({ text }: { text: string }) {
	return <LlmMarkdown>{text}</LlmMarkdown>
}
```

### Overview

- Renders partial markdown. For example, while Markdown is streaming links will be broken. These links are then rendered as text and only made clickable once the full link is present.
- Even if the LLM service outputs large chunks, this component will smoothly display the characters in much smaller chunks.
- Applies a fade-in effect as content is added quickly.
- Applies some default styling on top of the defaults of Streamdown / ReactMarkdown.

### Props

In addition to the props you can typically supply to `Streamdown` / `react-markdown`, you can also provide to `LlmMarkdown`:

#### `throttleFunction?: (deltaTimeMs: number, shown: number, full: number) => { addChars: number }`
Calculates the chunk size of new markdown to display, regardless of the chunk size of the LLM service.

 `deltaTimeMs` is the number of milliseconds since last called, `shown` is the number of characters shown, and `full` is the so far number of streamed Markdown characters.

When more Markdown content is available to show, this function will be called very frequently to gradually add the content. The return value determines the number of additional characters to show. For example, if the return value `addChars` is 1, the Markdown will be displayed character-by-character, regardless of the LLM output chunk size. You most likely want your return value to be proportional to `deltaTimeMs`.

#### `onContentShow?: (text: string) => void`
Called in a `useLayoutEffect` whenever new content is rendered. This is for example used by `ChatUi` to update the scroll position.

#### `fade?: boolean`
Whether or not to apply a fade effect as content is added quickly. Default: true.

## Chat UI

The `ChatUi` React components allow you to build chat interfaces easily.

### Usage

```typescript
<ChatUi
    messages={messages}
    UserMessageComponent={/* render user message */}
    AssistantMessageComponent={/* render assistant message, for example using LlmMarkdown */}
    ToolCallComponent={/* render tool calls */}
    footer={/* for example render a text input */ <input />}
/>

```

### Overview

- Takes a list of messages (assistant, user, tool, etc.), and functions that render those messages, as props
- Supports streaming assistant messages. This is done by grouping adjacent assistant messages together.
- Handles scroll behaviour. If the user scrolls to the bottom, the scroll will stick to the bottom as new messages are added. If the user scrolls up, the scroll will stick to that scroll position as new messages are added.

### Streaming assistant messages

To enable streaming assistant messages, push each chunk as a separate assistant message to the `messages` list. The `ChatUi` component will group adjacent assistant messages and render a single message bubble in the UI.

### Scroll

If you wrap the `ChatUi` component in a scroll container you must create `ref` of this container and provide this to the `ChatUi` component via the `scrollContainer` prop. If no such ref is provided, the component will assume you're the `document` as the scroll container.

## Frontend/Backend HTTP

This kit also includes a frontend *and* a backend helper function for generating LLM messages, executing tools, streaming content the client, and storing chat history in a database.

### Backend

The `generateAndStreamAiResponse` function generates assistant messages, streams those to the client, and stores messages in a database. It is agnostic over llm implementation and database. It returns a [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response), which then can be returned for example in your Next.js API route.

The function takes the following (all required) options:

#### llm: function

Function that takes a list of messages and returns an AsyncGenerator of LLM output chunks *and* a promise that resolves with success or an error.

#### runTool: function

Executes a tool and returns the result.

#### aiShouldTypeAfterTool: string[]

A list of tool names. For each of these tools, the AI will continue to type after the tool has been executed. Otherwise, the turn will go to the user.

#### messageData: any

Can contain anything - this data will also be sent to the LLM, and will also be stored in the database. Can change for each message. For example, it could contain the location of the user when they sent the message. If the user moves between messages, the LLM would be able to associate each message with a specific location.

#### header: string

Will be sent to the client before streaming the LLM output. Can then be read in the frontend.

#### committedMessages: Array of messages

Previous messages.

#### commitToDatabase: function

Saves messages in the database. Should return either `committed` or `cancelled`. If cancelled is returned, the client is notified. The client could then re-fetch the LLM output.

### Frontend

Use the `readStreamingBody` function to stream the response:
```typescript
const response = await fetch(`/api/chat/${sessionId}`)
// header is the string sent by `generateAndStreamAiResponse`
const { header, generator } = await readStreamingBody(response)
for await (const output of generator) {
	console.log(output)
}
```

## Mantine styling

This kit also contains `MantineLlmMarkdown` and `ChatMessageDisplay` in the `/markdown` file.

`MantineLlmMarkdown` uses `LlmMarkdown` but overrides the components with Mantine components (`Title`, `Text`, etc).

`ChatMessageDisplay` displays a chat message (user, tool, assistant, etc.) for a back-office application, such as an admin dashboard where chats can be visualized.
