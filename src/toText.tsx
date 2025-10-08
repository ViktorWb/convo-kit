import React from 'react'
import sharp from 'sharp'
import ReactMarkdown from 'react-markdown'
import { groupMessages } from './groupMessages'
import { Markdown } from './markdown'
import { ChatMessage, ToolCall, ToolDefinition } from './types'

export async function getImageBackgroundColor(s: sharp.Sharp): Promise<string> {
    const pixels: Buffer = await s.ensureAlpha().raw().toBuffer()

    let numWhitePixels = 0

    for (let i = 0; i < 100 * 100; i++) {
        const r = pixels[i * 4 + 0]
        const g = pixels[i * 4 + 1]
        const b = pixels[i * 4 + 2]
        const a = pixels[i * 4 + 3]

        if (a < 5 || (r > 210 && g > 210 && b > 210)) {
            numWhitePixels += 1
        }
    }
    if (numWhitePixels / (100 * 100) > 0.9) {
        return 'rgba(0,0,0,0.25)'
    }
    return 'unset'
}

export async function renderMessagesToText<D, T extends readonly ToolDefinition[]>(
    messages: { data: D; msg: ChatMessage<T> }[],
    language: 'en' | 'se',
    toText?: {
        user?: (previous: string, data: D) => string
        attachImage?: (previous: string, data: D) => string
        attachFile?: (previous: string, data: D) => string
        assistant?: (previous: string, data: D) => string
        tool?: (toolCall: ToolCall<T>, data: D) => string
    }
): Promise<{ text: string; html: React.ReactNode }> {
    toText = {
        user: toText?.user || ((x) => x),
        attachImage: toText?.attachImage || ((x) => x),
        attachFile: toText?.attachFile || ((x) => x),
        assistant: toText?.assistant || ((x) => x),
        tool: toText?.tool || ((x) => (language === 'en' ? `<tool ${x.function.name} was called>` : `<verktyg ${x.function.name} användes>`))
    }

    const grouped = groupMessages(messages.map((x) => ({ data: x.data, ...x.msg })))

    const chatText: string[] = []

    grouped.forEach(({ msg }) => {
        if (msg.role === 'user') {
            msg.content.forEach((x) => {
                if (x.type === 'text') {
                    chatText.push(`${toText.user(language === 'en' ? 'User' : 'Användare', msg.data)}:\n${x.content}`)
                } else if (x.type === 'image') {
                    chatText.push(toText.attachImage(language === 'en' ? 'User attached an image' : 'Användaren bifogade en bild', msg.data))
                } else if (x.type === 'file') {
                    chatText.push(toText.attachFile(language === 'en' ? 'User attached a file' : 'Användaren bifogade en fil', msg.data))
                }
            })
        } else if (msg.role === 'assistant') {
            chatText.push(`${language === 'en' ? 'Assistant' : 'Assistent'}:\n${msg.content}`)
        } else if (msg.role === 'toolCall') {
            const text = toText.tool(msg.toolCall, msg.data)
            if (text) {
                chatText.push(text)
            }
        }
    })

    return {
        text: chatText.join('\n\n'),
        html: (
            <>
                {await Promise.all(
                    grouped.map(async ({ msg }, i) => {
                        if (msg.role === 'user') {
                            return (
                                <React.Fragment key={i}>
                                    {await Promise.all(
                                        msg.content.map(async (x, i2) => {
                                            if (x.type === 'text') {
                                                return (
                                                    <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxWidth: '50em' }} key={i2}>
                                                        <b>{toText.user(language === 'en' ? 'User' : 'Användare', msg.data)}:</b>
                                                        <br />
                                                        {x.content}
                                                    </p>
                                                )
                                            }
                                            if (x.type === 'image') {
                                                const s = sharp(Buffer.from(x.base64, 'base64'))
                                                const metadata = await s.metadata()
                                                const width = Math.min((metadata.width / metadata.height) * 20, 20)
                                                const height = Math.min((metadata.height / metadata.width) * 20, 20)

                                                const backgroundColor = await getImageBackgroundColor(s)

                                                return (
                                                    <React.Fragment key={i2}>
                                                        <p>
                                                            <b>
                                                                {toText.attachImage(
                                                                    language === 'en' ? 'User attached an image' : 'Användaren bifogade en bild',
                                                                    msg.data
                                                                )}
                                                                :
                                                            </b>
                                                        </p>
                                                        <img
                                                            src={`data:${x.mimeType};base64,${x.base64}`}
                                                            style={{
                                                                width: width.toFixed(1) + 'em',
                                                                height: height.toFixed(1) + 'em',
                                                                objectFit: 'contain',
                                                                backgroundColor
                                                            }}
                                                        />
                                                    </React.Fragment>
                                                )
                                            }
                                            return (
                                                <p key={i2}>
                                                    <b>
                                                        {toText.attachFile(language === 'en' ? 'User attached a file' : 'Användaren bifogade en fil', msg.data)}
                                                    </b>
                                                </p>
                                            )
                                        })
                                    )}
                                </React.Fragment>
                            )
                        } else if (msg.role === 'assistant') {
                            return (
                                <div style={{ maxWidth: '50em' }} key={i}>
                                    <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }} key={i}>
                                        <b>{toText.assistant(language === 'en' ? 'Assistant' : 'Assistent', msg.data)}:</b>
                                        <br />
                                    </p>
                                    <Markdown component={ReactMarkdown}>{msg.content}</Markdown>
                                </div>
                            )
                        } else if (msg.role === 'toolCall') {
                            const text = toText.tool(msg.toolCall, msg.data)
                            if (text) {
                                return (
                                    <p key={i}>
                                        <i>{text}</i>
                                    </p>
                                )
                            }
                            return null
                        }
                    })
                )}
            </>
        )
    }
}
