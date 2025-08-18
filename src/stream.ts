import { v4 as uuidv4 } from 'uuid'
import { isAiTyping, StreamedBodyItem } from './streamClient'
import { ChatMessageContent, LlmOutputChatMessage, ChatMessage, ToolCall, ToolDefinition, ToolName } from './types'

function encodeChunk(text: string): Buffer {
    const buf = Buffer.from(text)
    const lenBuf = Buffer.alloc(4)
    lenBuf.writeUint32BE(buf.byteLength)
    return Buffer.concat([lenBuf, buf])
}

function encodeStreamedItem<M, T extends readonly ToolDefinition[]>(item: StreamedBodyItem<M, T>): Buffer {
    return encodeChunk(JSON.stringify(item))
}

export type CommittedMessage<D, T extends readonly ToolDefinition[]> = { key: string; msg: ChatMessage<T>; timestamp: Date; messageData: D }

export function generateAndStreamAiResponse<D, T extends readonly ToolDefinition[]>(options: {
    llm: (
        inputs: CommittedMessage<D, T>[]
    ) => Promise<{ promise: Promise<{ error: true } | { error: false; cost: number }>; generator: AsyncGenerator<LlmOutputChatMessage<T>> }>
    runTool: (
        messages: { key: string; msg: ChatMessage<T>; timestamp: Date; messageData: D }[],
        toolCall: ToolCall<T>
    ) => Promise<{
        result: Record<string, unknown>
        additionalParts: ChatMessageContent[]
        cost: number
    }>
    aiShouldTypeAfterTool: readonly ToolName<T>[]
    messageData: D
    header: string
    committedMessages: CommittedMessage<D, T>[]
    commitToDatabase: (
        committedMessages: CommittedMessage<D, T>[],
        newMessages: CommittedMessage<D, T>[],
        addedCost: number
    ) => Promise<'committed' | 'cancelled'>
}): Response {
    const updatingCommittedMessages = options.committedMessages.slice()
    return new Response(
        new ReadableStream({
            async pull(controller) {
                try {
                    controller.enqueue(encodeChunk(options.header))
                } catch {}

                for (const msg of updatingCommittedMessages) {
                    try {
                        controller.enqueue(
                            encodeStreamedItem<D, T>({
                                type: 'msg',
                                committed: true,
                                key: msg.key,
                                msg: msg.msg,
                                timestamp: msg.timestamp.getTime(),
                                messageData: msg.messageData
                            })
                        )
                    } catch {}
                }

                let newMessages: { key: string; msg: ChatMessage<T>; timestamp: Date; messageData: D }[] = []
                let newCost: number = 0

                let count = 0
                while (
                    isAiTyping(
                        updatingCommittedMessages.map((x) => x.msg),
                        options.aiShouldTypeAfterTool
                    ) === 'typing'
                ) {
                    count++
                    if (count > 5) {
                        break
                    }

                    const { promise, generator } = await options.llm(updatingCommittedMessages)

                    const collected: LlmOutputChatMessage<T>[] = []
                    for await (const msg of generator) {
                        collected.push(msg)
                        const msgWithKey = { key: uuidv4(), msg, timestamp: new Date(), messageData: options.messageData }
                        try {
                            controller.enqueue(
                                encodeStreamedItem({
                                    type: 'msg',
                                    committed: false,
                                    key: msgWithKey.key,
                                    msg: msgWithKey.msg,
                                    timestamp: msgWithKey.timestamp.getTime(),
                                    messageData: msgWithKey.messageData
                                })
                            )
                        } catch {}
                        newMessages.push(msgWithKey)
                    }

                    if (collected.length === 0) {
                        const forceAddMsg: LlmOutputChatMessage<T> = { role: 'assistant', content: 'Did not write anything' }
                        collected.push(forceAddMsg)
                        const msgWithKey = { key: uuidv4(), msg: forceAddMsg, timestamp: new Date(), messageData: options.messageData }
                        try {
                            controller.enqueue(
                                encodeStreamedItem({
                                    type: 'msg',
                                    committed: false,
                                    key: msgWithKey.key,
                                    msg: msgWithKey.msg,
                                    timestamp: msgWithKey.timestamp.getTime(),
                                    messageData: msgWithKey.messageData
                                })
                            )
                        } catch {}
                        newMessages.push(msgWithKey)
                    }

                    const res = await promise
                    if (res.error === true) {
                        try {
                            controller.enqueue(encodeStreamedItem({ type: 'error', error: 'AI is not responding' }))
                            controller.close()
                        } catch {}
                        return
                    }

                    newCost += res.cost

                    for (const msg of collected) {
                        if (msg.role !== 'toolCall') {
                            continue
                        }
                        const res = await options.runTool([...updatingCommittedMessages, ...newMessages], msg.toolCall)
                        newCost += res.cost
                        const responseMsg: { key: string; msg: ChatMessage<T>; timestamp: Date; messageData: D } = {
                            key: uuidv4(),
                            timestamp: new Date(),
                            msg: {
                                role: 'toolResponse',
                                name: msg.toolCall.function.name,
                                toolCallId: msg.toolCall.toolCallId,
                                content: res.result,
                                additionalParts: res.additionalParts
                            },
                            messageData: options.messageData
                        }
                        newMessages.push(responseMsg)
                        try {
                            controller.enqueue(
                                encodeStreamedItem({
                                    type: 'msg',
                                    committed: false,
                                    key: responseMsg.key,
                                    msg: responseMsg.msg,
                                    timestamp: responseMsg.timestamp.getTime(),
                                    messageData: responseMsg.messageData
                                })
                            )
                        } catch {}
                    }

                    const commitResult = await options.commitToDatabase(updatingCommittedMessages, newMessages, newCost)

                    if (commitResult === 'cancelled') {
                        try {
                            controller.enqueue(encodeStreamedItem({ type: 'error', error: 'Cancelled' }))
                            controller.close()
                        } catch {}
                        return
                    }

                    updatingCommittedMessages.push(...newMessages)
                    newMessages = []

                    newCost = 0
                }

                try {
                    controller.enqueue(encodeStreamedItem({ type: 'done' }))
                    controller.close()
                } catch {}
            }
        }),
        { status: 200, headers: { 'Content-Type': 'application/octet-stream' } }
    )
}

export function generateAndStreamAiResponseWithoutTools<D>(options: {
    llm: (
        inputs: CommittedMessage<D, []>[]
    ) => Promise<{ promise: Promise<{ error: true } | { error: false; cost: number }>; generator: AsyncGenerator<LlmOutputChatMessage<[]>> }>
    buildAiInputs: (inputs: CommittedMessage<D, []>[]) => Promise<{ success: boolean; result?: { messages: ChatMessage<[]>[]; aiCostUsd: number } }>
    messageData: D
    header: string
    committedMessages: CommittedMessage<D, []>[]
    commitToDatabase: (
        committedMessages: CommittedMessage<D, []>[],
        newMessages: CommittedMessage<D, []>[],
        newAiCostUsd: number
    ) => Promise<'committed' | 'cancelled'>
}): Response {
    return generateAndStreamAiResponse<D, []>({
        llm: options.llm,
        aiShouldTypeAfterTool: [] as never[],
        runTool: () => Promise.reject('Unexpected runTool'),
        messageData: options.messageData,
        header: options.header,
        committedMessages: options.committedMessages,
        commitToDatabase: options.commitToDatabase
    })
}
