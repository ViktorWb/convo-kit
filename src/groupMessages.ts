import { ChatMessage, ToolDefinition } from './types'

export function groupMessages<S extends ChatMessage<T>, T extends readonly ToolDefinition[]>(messages: S[]) {
    const grouped: { indexes: number[]; msg: S }[] = []
    messages.forEach((msg, i) => {
        if (grouped.length === 0) {
            grouped.push({ indexes: [i], msg: { ...msg } })
            return
        }
        const last = grouped[grouped.length - 1]
        if (msg.role === 'assistant' && last.msg.role === 'assistant') {
            last.indexes.push(i)
            last.msg.content += msg.content
        } else {
            grouped.push({ indexes: [i], msg: { ...msg } })
        }
    })
    return grouped
}
