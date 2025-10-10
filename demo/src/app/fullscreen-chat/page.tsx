'use client'

import { useState } from 'react'
import { Box, Button, Paper, Text, TextInput } from '@mantine/core'
import { ChatMessage, ChatUi } from '@/../../'
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

    return (
        <>
            <Button
                mt="1em"
                style={{ position: 'fixed', top: '3em' }}
                onClick={() => {
                    setMessages([
                        ...messages,
                        {
                            role: 'assistant',
                            content: 'Hi!\n\nThis is a test.\n\n- A\n\n- B\n\n- C\n\n- D'
                        }
                    ])
                }}
            >
                Add assistant answer
            </Button>
            <Box maw="60em" mx="auto">
                <Text size="sm" maw="80ch">
                    This demo shows the sticky-scroll behaviour for fullscreen scroll areas. When the user scrolls to the bottom of the container, the scroll is
                    sticks to the bottom as new messages are added. When the user is not at the bottom, the scroll stays at the current scroll position.
                </Text>
                <ChatUi
                    messages={messages}
                    UserMessageComponent={(props) =>
                        props.content.type === 'text' ? (
                            <Paper maw="30em" ml="auto" mt="0.5em" bg="#ABF" p="0.5em">
                                <Text>{props.content.content}</Text>
                            </Paper>
                        ) : null
                    }
                    AssistantMessageComponent={AssistantMessageComponent}
                    ToolCallComponent={() => null}
                    footer={
                        <>
                            <Text mt="0.5em" size="sm">
                                Footer
                            </Text>
                            <Box pb={32} style={{ position: 'sticky', bottom: 0 }}>
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
                    }
                />
                <Text size="sm" my="2em">
                    Content below the chat interface.
                </Text>
            </Box>
        </>
    )
}
