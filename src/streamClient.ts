import { ChatMessage, ToolDefinition, ToolName } from './types'

export function isAiTyping<T extends readonly ToolDefinition[]>(
    messages: ChatMessage<T>[],
    aiShouldTypeAfterTool: readonly ToolName<T>[]
): 'typing' | 'callingTool' | 'none' {
    if (messages.some((x) => x.role === 'toolCall' && !messages.some((y) => y.role === 'toolResponse' && x.toolCall.toolCallId === y.toolCallId))) {
        return 'callingTool'
    }

    const lastAssistantMessage = messages.findLastIndex((x) => x.role === 'assistant')
    if (lastAssistantMessage < 0) {
        return 'typing'
    }

    if (messages.slice(lastAssistantMessage).some((x) => x.role === 'user')) {
        return 'typing'
    }

    const toolsAfterLastAssistantMessage = messages
        .slice(lastAssistantMessage)
        .map((x) => (x.role === 'toolCall' ? x.toolCall.function.name : null))
        .filter((x) => x !== null)

    if (aiShouldTypeAfterTool.some((x) => toolsAfterLastAssistantMessage.includes(x))) {
        return 'typing'
    }

    return 'none'
}

export type StreamedBodyItem<M, T extends readonly ToolDefinition[] = ToolDefinition[]> =
    | { type: 'msg'; key: string; msg: ChatMessage<T>; timestamp: number; committed: boolean; messageData: M }
    | { type: 'done' }
    | { type: 'error'; error: string }

async function* _readStreamingBody(response: Response): AsyncGenerator<string> {
    const reader = response.body.getReader()
    let buf = Buffer.alloc(0)
    while (true) {
        const { done, value } = await reader.read()
        if (value) {
            buf = Buffer.concat([buf, value])
        }
        while (true) {
            if (buf.byteLength < 4) {
                if (!value && done) {
                    return
                }
                break
            }
            const length = buf.readUint32BE()
            if (buf.byteLength < 4 + length) {
                if (!value && done) {
                    return
                }
                break
            }
            const item = buf.subarray(4, 4 + length).toString()
            buf = buf.subarray(4 + length)
            yield item
        }
    }
}

export async function readStreamingBody<M, T extends readonly ToolDefinition[] = ToolDefinition[]>(
    response: Response
): Promise<{ header: string; generator: AsyncGenerator<StreamedBodyItem<M, T>> }> {
    const generator = _readStreamingBody(response)

    const header = await generator.next()
    if (header.done) {
        throw new Error('Failed to read streaming body: Malformed body')
    }

    async function* parsed() {
        for await (const item of generator) {
            yield JSON.parse(item)
        }
    }

    return {
        header: header.value,
        generator: parsed()
    }
}
