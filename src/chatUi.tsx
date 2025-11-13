import React, { ComponentProps, useCallback, useEffect, useMemo, useRef } from 'react'
import { groupMessages } from './groupMessages'
import { ChatMessageContent, ChatMessage, ToolCall, ToolDefinition } from './types'

export function ScrollBox(
    props: {
        scrollContainer?: () => HTMLElement
        renderContent: (onExpanded: () => void) => React.ReactNode
    } & Omit<ComponentProps<'div'>, 'children'>
) {
    const { scrollContainer, renderContent, ...rest } = props

    const chatUiRef = useRef<HTMLDivElement>(null)

    const scrollIsBottomRef = useRef(true)
    const lastShowContentTimestampRef = useRef(0)
    useEffect(() => {
        const cb = () => {
            if (!chatUiRef.current || Date.now() - lastShowContentTimestampRef.current < 200) {
                return
            }
            const container = props.scrollContainer ? props.scrollContainer() : document.documentElement
            if (!container) {
                return
            }

            const chatUiRect = chatUiRef.current.getBoundingClientRect()
            const containerRect = container.getBoundingClientRect()
            const chatUiBottom = chatUiRect.bottom + window.scrollY
            const containerBottom = props.scrollContainer ? containerRect.bottom + window.scrollY : container.clientHeight + window.scrollY
            scrollIsBottomRef.current = chatUiBottom - containerBottom <= 5
        }
        if (props.scrollContainer) {
            const container = props.scrollContainer()
            if (!container) {
                return
            }
            container.addEventListener('scroll', cb)
            return () => {
                container.removeEventListener('scroll', cb)
            }
        } else {
            document.addEventListener('scroll', cb)
            return () => {
                document.removeEventListener('scroll', cb)
            }
        }
    }, [])

    function scrollToBottomIfNeeded() {
        if (!scrollIsBottomRef.current || !chatUiRef.current) {
            return
        }
        const container = props.scrollContainer ? props.scrollContainer() : document.documentElement
        if (!container) {
            return
        }
        const chatUiRect = chatUiRef.current.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        const chatUiBottom = chatUiRect.bottom + window.scrollY
        const containerBottom = props.scrollContainer ? containerRect.bottom + window.scrollY : container.clientHeight + window.scrollY

        const addToScroll = chatUiBottom - containerBottom
        if (addToScroll > 0) {
            if (props.scrollContainer) {
                container.scrollTo(0, container.scrollTop + addToScroll)
            } else {
                window.scrollTo(0, container.scrollTop + addToScroll)
            }
        }
    }

    useEffect(() => {
        scrollToBottomIfNeeded()
    }, [props.renderContent])

    return (
        <div ref={chatUiRef} {...rest}>
            {props.renderContent(() => {
                lastShowContentTimestampRef.current = Date.now()
                scrollToBottomIfNeeded()
            })}
        </div>
    )
}

export function ChatUi<T extends readonly ToolDefinition[] = readonly ToolDefinition[]>(
    props: {
        messages: ChatMessage<T>[]
        UserMessageComponent: React.ComponentType<{ messageIndex: number; groupedMessages: ChatMessage<T>[]; content: ChatMessageContent }>
        AssistantMessageComponent: React.ComponentType<{
            messageIndex: number
            groupedMessages: ChatMessage<T>[]
            text: string
            onContentShow: (text: string) => void
        }>
        scrollContainer?: () => HTMLElement
        ToolCallComponent: React.ComponentType<{ messageIndex: number; groupedMessages: ChatMessage<T>[]; toolCall: ToolCall<T> }>
        footer?: React.ReactNode
    } & ComponentProps<'div'>
) {
    const { messages, UserMessageComponent, AssistantMessageComponent, ToolCallComponent, footer, ...rest } = props

    const groupedMessages = useMemo(() => groupMessages(props.messages), [props.messages])

    const renderContent = useCallback(
        (onExpanded: () => void) => {
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
                                        onContentShow={() => {
                                            onExpanded()
                                        }}
                                    />
                                )
                            }
                            return <props.ToolCallComponent key={key} messageIndex={i} groupedMessages={arr.map((x) => x.msg)} toolCall={msg.toolCall} />
                        })}
                    {props.footer || null}
                </>
            )
        },
        [groupedMessages]
    )

    return <ScrollBox renderContent={renderContent} {...rest} />
}
