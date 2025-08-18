'use client'

import React, { useLayoutEffect, useRef, useState } from 'react'
import { Paper, Spoiler, Text } from '@mantine/core'
import { ChatMessage } from '../types'

function ContentBox(props: React.PropsWithChildren<{}>) {
    const [expanded, setExpanded] = useState(false)
    const outerRef = useRef<HTMLDivElement>(null)
    const innerRef = useRef<HTMLDivElement>(null)
    const expandButtonRef = useRef<HTMLAnchorElement>(null)

    useLayoutEffect(() => {
        if (innerRef.current.clientHeight > outerRef.current.clientHeight) {
            expandButtonRef.current.style.visibility = 'visible'
        }
    }, [])

    return (
        <>
            <Paper
                style={{
                    marginTop: '1em',
                    padding: '0.5em',
                    position: 'relative',
                    boxShadow: '0 0 5px 0px rgba(0,0,0,0.1)'
                }}
            >
                <div ref={outerRef}>
                    <Spoiler maxHeight={130} showLabel={null} hideLabel={null} expanded={expanded} c="var(--mantine-color-gray-8)">
                        <div ref={innerRef}>{props.children}</div>
                    </Spoiler>
                </div>
            </Paper>
            <Text
                ref={expandButtonRef}
                component="a"
                size="sm"
                c="var(--mantine-color-gray-8)"
                style={{ cursor: 'pointer', visibility: 'hidden' }}
                onClick={() => setExpanded(!expanded)}
            >
                {expanded ? 'Collapse' : 'Expand'}
            </Text>
        </>
    )
}

export function ChatMessageDisplay<D>(props: {
    messages: (ChatMessage & { data?: D })[]
    message: ChatMessage & { data?: D }
    renderData?: React.ComponentType<{ data: D }>
    toText?: {
        user?: (previous: string, data: D) => string
    }
}) {
    const RenderData = props.renderData || (() => null)
    const toText = {
        user: props.toText?.user || ((x) => x)
    }

    if (props.message.role === 'system') {
        return (
            <ContentBox>
                <Text size="sm">System</Text>
                <RenderData data={props.message.data} />
                <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                    {props.message.content}
                </Text>
            </ContentBox>
        )
    }
    if (props.message.role === 'user') {
        return (
            <ContentBox>
                <Text size="sm">{toText.user('User', props.message.data)}</Text>
                <RenderData data={props.message.data} />
                {props.message.content.map((content, i) => {
                    if (content.type === 'text') {
                        return (
                            <Text key={i} size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                                {content.content}
                            </Text>
                        )
                    }
                    if (content.type === 'image') {
                        return (
                            <img
                                key={i}
                                style={{ width: '10em', height: '10em', objectFit: 'contain' }}
                                src={`data:${content.mimeType};base64,${content.base64}`}
                            />
                        )
                    }
                    return (
                        <a style={{ display: 'flex', gap: '0.5em' }} href={`data:application/pdf;base64,${content.base64}`} target="_blank" key={i}>
                            <Text size="sm" component="span">
                                PDF
                            </Text>
                        </a>
                    )
                })}
            </ContentBox>
        )
    }
    if (props.message.role === 'assistant') {
        return (
            <ContentBox>
                <Text size="sm">Assistant</Text>
                <RenderData data={props.message.data} />
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                    {props.message.content}
                </Text>
            </ContentBox>
        )
    }
    if (props.message.role === 'toolCall') {
        const toolCall = props.message.toolCall
        const response = props.messages.find((y) => y.role === 'toolResponse' && y.toolCallId === toolCall.toolCallId) as Extract<
            (typeof props.messages)[0],
            { role: 'toolResponse' }
        >
        return (
            <ContentBox>
                <Text size="sm">Tool call</Text>
                <RenderData data={props.message.data} />
                <Text size="sm">
                    {props.message.toolCall.function.name}({JSON.stringify(props.message.toolCall.function.arguments, null, 2)})
                </Text>
                <Text size="sm">Tool response</Text>
                {response ? <RenderData data={response.data} /> : null}
                <Text size="sm">{response ? JSON.stringify(response.content, null, 2) : 'No response'}</Text>
                {response
                    ? response.additionalParts.map((content, i) => {
                          if (content.type === 'text') {
                              return (
                                  <Text key={i} size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                                      {content.content}
                                  </Text>
                              )
                          }
                          if (content.type === 'image') {
                              return (
                                  <img
                                      key={i}
                                      style={{ width: '10em', height: '10em', objectFit: 'contain' }}
                                      src={`data:${content.mimeType};base64,${content.base64}`}
                                  />
                              )
                          }
                          return (
                              <a style={{ display: 'flex', gap: '0.5em' }} href={`data:application/pdf;base64,${content.base64}`} target="_blank" key={i}>
                                  <Text size="sm" component="span">
                                      PDF
                                  </Text>
                              </a>
                          )
                      })
                    : null}
            </ContentBox>
        )
    }
    return null
}
