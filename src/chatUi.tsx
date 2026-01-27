import React, { ComponentProps, useCallback, useMemo } from 'react'
import { groupMessages } from './groupMessages'
import { ChatMessageContent, ChatMessage, ToolCall, ToolDefinition } from './types'
import { ScrollBox } from './stickToBottom'

export function ChatUi<T extends readonly ToolDefinition[] = readonly ToolDefinition[]>(
    props: {
        messages: ChatMessage<T>[]
        streaming: boolean
        UserMessageComponent: React.ComponentType<{ messageIndex: number; groupedMessages: ChatMessage<T>[]; content: ChatMessageContent }>
        AssistantMessageComponent: React.ComponentType<{
            messageIndex: number
            groupedMessages: ChatMessage<T>[]
            text: string
            streaming: boolean
        }>
        maxHeight?: string | number
        ToolCallComponent: React.ComponentType<{ messageIndex: number; groupedMessages: ChatMessage<T>[]; toolCall: ToolCall<T> }>
        footer?: (isAtBottom: boolean, scrollToBottom: () => void) => React.ReactNode
    } & ComponentProps<'div'>
) {
    const { messages, UserMessageComponent, AssistantMessageComponent, ToolCallComponent, footer, ...rest } = props

    const groupedMessages = useMemo(() => groupMessages(props.messages), [props.messages])

    const renderContent = useCallback(
        (isAtBottom: boolean, scrollToBottom: () => void) => {
            return (
                <>
                    {groupedMessages
                        .filter((msg) => msg.msg.role !== 'system' && msg.msg.role !== 'toolResponse')
                        .map(({ indexes, msg }: { indexes: number[]; msg: Exclude<ChatMessage<T>, { role: 'system' | 'toolResponse' }> }, i, arr) => {
                            const key = indexes[0]

                            if (msg.role === 'user') {
                                return (
                                    <React.Fragment key={key}>
                                        {msg.content.map((x, i2) => (
                                            <props.UserMessageComponent key={i2} messageIndex={i} groupedMessages={arr.map((x) => x.msg)} content={x} />
                                        ))}
                                    </React.Fragment>
                                )
                            }
                            if (msg.role === 'assistant') {
                                return msg.content === '' ? null : (
                                    <props.AssistantMessageComponent
                                        key={key}
                                        messageIndex={i}
                                        groupedMessages={arr.map((x) => x.msg)}
                                        text={msg.content}
                                        streaming={props.streaming && i === arr.length - 1}
                                    />
                                )
                            }
                            return <props.ToolCallComponent key={key} messageIndex={i} groupedMessages={arr.map((x) => x.msg)} toolCall={msg.toolCall} />
                        })}
                    {props.footer?.(isAtBottom, scrollToBottom) || null}
                </>
            )
        },
        [groupedMessages]
    )

    return <ScrollBox renderContent={renderContent} {...rest} />
}
