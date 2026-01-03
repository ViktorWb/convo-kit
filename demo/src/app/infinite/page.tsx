'use client'

import React, { useEffect, useState } from 'react'
import { Box, Button, Paper, Text, TextInput } from '@mantine/core'
import { ChatMessage, ChatUi } from '@/../../src/browser'
import { MantineLlmMarkdown } from '@/../../src/mantine'

const AssistantMessageComponent: React.ComponentProps<typeof ChatUi>['AssistantMessageComponent'] = (props) => {
    return (
        <div style={{ backgroundColor: '#CCC', width: '60%', marginTop: '0.5em', padding: '0.5em', borderRadius: '0.5em' }}>
            <MantineLlmMarkdown fade={false} textProps={{ size: 'sm' }} onContentShow={props.onContentShow}>
                {props.text}
            </MantineLlmMarkdown>
        </div>
    )
}

export default function () {
    const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: 'Welcome to this demo' }])

    const [value, setValue] = useState('')

    useEffect(() => {
        const interval = setInterval(() => {
            setMessages((old) => [
                ...old,
                {
                    role: 'assistant',
                    content: 'Hi!\n\nThis is a test.\n\n- A\n\n- B\n\n- C\n\n- D'
                }
            ])
        }, 500)
        return () => {
            clearInterval(interval)
        }
    }, [])

    return (
        <>
            <Box maw="60em" mx="auto">
                <Text size="sm" maw="80ch">
                    This demo shows the sticky-scroll behaviour for contained scroll areas. When the user scrolls to the bottom of the container, the scroll is
                    sticks to the bottom as new messages are added. When the user is not at the bottom, the scroll stays at the current scroll position.
                </Text>
                <ChatUi
                    messages={messages}
                    maxHeight="30em"
                    UserMessageComponent={(props) =>
                        props.content.type === 'text' ? (
                            <Paper maw="30em" ml="auto" mt="0.5em" bg="#ABF" p="0.5em">
                                <Text>{props.content.content}</Text>
                            </Paper>
                        ) : null
                    }
                    AssistantMessageComponent={AssistantMessageComponent}
                    ToolCallComponent={() => null}
                    footer={(isAtBottom, scrollToBottom) => (
                        <Text mt="0.5em" size="sm" onClick={scrollToBottom}>
                            Footer ({isAtBottom ? ' at bottom' : 'not at bottom'})
                        </Text>
                    )}
                />
                <Text size="sm" my="2em">
                    Content below the chat interface.
                </Text>
                <TextInput
                    placeholder="Type something.."
                    value={value}
                    onChange={(ev) => setValue(ev.target.value)}
                    onKeyDown={(ev) => {
                        if (ev.key === 'Enter' && !ev.shiftKey) {
                            setMessages([...messages, { role: 'user', content: [{ type: 'text', content: value }] }])
                            setValue('')
                        }
                    }}
                />
            </Box>
        </>
    )
}
