import * as z from 'zod'

export const toolDefinitionSchema = z.object({
    type: z.literal('function'),
    function: z
        .object({
            name: z.string().max(200),
            description: z.string(),
            parameters: z
                .object({
                    type: z.literal('object'),
                    properties: z
                        .record(
                            z.string().max(200),
                            z
                                .object({
                                    type: z.literal(['string', 'number']),
                                    description: z.string()
                                })
                                .readonly()
                        )
                        .readonly()
                })
                .readonly()
        })
        .readonly()
})

export type ToolDefinition = z.infer<typeof toolDefinitionSchema>

export type ToolName<T extends readonly ToolDefinition[]> = T[number]['function']['name']

export type ParameterType<T extends ToolDefinition['function']['parameters']['properties'][string]> = T extends { type: 'string' }
    ? string
    : T extends { type: 'number' }
      ? number
      : unknown

export const toolCallSchema = z.object({
    type: z.literal('function'),
    function: z.object({
        name: z.string().max(200),
        arguments: z.record(z.string().max(200), z.union([z.string(), z.number()]))
    }),
    toolCallId: z.string().max(200)
})

type ToolCallType<T extends ToolDefinition> = {
    name: T['function']['name']
    arguments: { [K in keyof T['function']['parameters']['properties']]: ParameterType<T['function']['parameters']['properties'][K]> }
}

export type ToolCall<T extends readonly ToolDefinition[] = readonly ToolDefinition[]> = {
    type: 'function'
    function: { [K in keyof T]: ToolCallType<T[K]> }[number]
    toolCallId: string
}

export const chatMessageContentSchema = z.union([
    z.object({
        type: z.literal('text'),
        content: z.string()
    }),
    z.object({
        type: z.literal('image'),
        mimeType: z.string().max(200),
        base64: z.base64()
    }),
    z.object({
        type: z.literal('file'),
        base64: z.base64()
    })
])

export type ChatMessageContent = z.infer<typeof chatMessageContentSchema>

export const chatMessageSchema = z.union([
    z.object({ role: z.literal('system'), content: z.string() }),
    z.object({ role: z.literal('user'), content: z.array(chatMessageContentSchema) }),
    z.object({ role: z.literal('assistant'), content: z.string() }),
    z.object({ role: z.literal('toolCall'), toolCall: toolCallSchema }),
    z.object({
        role: z.literal('toolResponse'),
        name: z.string().max(200),
        content: z.any(),
        additionalParts: z.array(chatMessageContentSchema),
        toolCallId: z.string().max(200)
    })
])

export type ChatMessage<T extends readonly ToolDefinition[] = readonly ToolDefinition[]> =
    | Exclude<z.infer<typeof chatMessageSchema>, { role: 'toolCall' | 'toolResponse' }>
    | (Omit<Extract<z.infer<typeof chatMessageSchema>, { role: 'toolCall' }>, 'toolCall'> & { toolCall: ToolCall<T> })
    | (Omit<Extract<z.infer<typeof chatMessageSchema>, { role: 'toolResponse' }>, 'name'> & { name: ToolName<T> })

export type LlmOutputChatMessage<T extends readonly ToolDefinition[] = readonly ToolDefinition[]> = Extract<ChatMessage<T>, { role: 'assistant' | 'toolCall' }>

/**
 * Checks the output from the LLM to ensure it is a valid tool call, as given by the tool definitions.
 *
 * If valid, a sanitized version of *toolCall* is returned.
 */
export function validateToolCall<T extends readonly ToolDefinition[] = readonly ToolDefinition[]>(toolCall: ToolCall, definitions: T): ToolCall<T> | null {
    try {
        const parsed = toolCallSchema.parse(toolCall)
        for (const definition of definitions) {
            if (definition.function.name === parsed.function.name) {
                const newArguments = {}
                for (const [key, definitionValue] of Object.entries(definition.function.parameters.properties)) {
                    const value = parsed.function.arguments[key]
                    if (typeof value === 'undefined' || value === null) {
                        return null
                    }
                    if (typeof value !== definitionValue.type) {
                        return null
                    }
                    newArguments[key] = value
                }
                return {
                    type: 'function',
                    function: {
                        name: definition.function.name,
                        arguments: newArguments
                    } as any,
                    toolCallId: parsed.toolCallId
                }
            }
        }
        return null
    } catch {
        return null
    }
}
