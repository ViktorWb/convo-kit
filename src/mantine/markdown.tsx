import React, { ComponentProps, useMemo } from 'react'
import { Anchor, AnchorProps, Text, TextProps, Title, TitleOrder, TitleProps } from '@mantine/core'
import { LlmMarkdown } from '../llm-markdown'
import { Markdown } from '../markdown'

function useMappedComponents(
    components: ComponentProps<typeof Markdown>['components'],
    titleProps?: TitleProps,
    textProps?: TextProps,
    anchorProps?: AnchorProps
) {
    const { style: titleStyle, ...titlePropsRest } = titleProps || {}
    const { style: textStyle, ...textPropsRest } = textProps || {}
    const { style: anchorStyle, ...anchorPropsRest } = anchorProps || {}

    return useMemo((): ComponentProps<typeof Markdown>['components'] => {
        return {
            ...Object.fromEntries(
                Array.from(new Array(6)).map((_, i) => {
                    return [
                        `h${i + 1}`,
                        (props2: React.PropsWithChildren<{ style?: React.CSSProperties }>) => (
                            <Title order={(i + 1) as TitleOrder} style={{ ...props2.style, ...titleStyle }} {...titlePropsRest}>
                                {props2.children}
                            </Title>
                        )
                    ]
                })
            ),
            p: (props2) => {
                return (
                    <Text style={{ ...props2.style, ...textStyle }} {...textPropsRest}>
                        {props2.children}
                    </Text>
                )
            },
            a: (props2) => {
                return (
                    <Anchor href={props2.href} target="_blank" style={{ ...props2.style, ...anchorStyle }} {...anchorPropsRest}>
                        {props2.children}
                    </Anchor>
                )
            },
            li: (props2) => {
                return (
                    <Text component="li" style={{ ...props2.style, ...textStyle }} {...textPropsRest}>
                        {props2.children}
                    </Text>
                )
            },
            ...components
        }
    }, [components])
}

/**
 * Wrapper of [react-markdown](https://github.com/remarkjs/react-markdown) that adds mantine styling.
 */
export function MantineMarkdown(props: React.ComponentProps<typeof Markdown> & { titleProps?: TitleProps; textProps?: TextProps; anchorProps?: AnchorProps }) {
    const { components, ...rest } = props

    const mappedComponents = useMappedComponents(components, props.titleProps, props.textProps, props.anchorProps)

    return <Markdown components={mappedComponents} {...rest} />
}

/**
 * React component that renders streaming markdown output using mantine styling.
 *
 * See [llm-ui docs](https://llm-ui.com/docs/llm-output-hook) and [react markdown docs](https://github.com/remarkjs/react-markdown?tab=readme-ov-file#options) for info on props.
 *
 * Use the *titleProps*, *textProps* and *anchorProps* if you want to configure the mantine components.
 */
export function MantineLlmMarkdown(
    props: React.ComponentProps<typeof LlmMarkdown> & { titleProps?: TitleProps; textProps?: TextProps; anchorProps?: AnchorProps }
) {
    const { components, titleProps, textProps, anchorProps, ...rest } = props

    const mappedComponents = useMappedComponents(components, titleProps, textProps, anchorProps)

    return <LlmMarkdown components={mappedComponents} {...rest} />
}
