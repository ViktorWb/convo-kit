import React from 'react'
import { Streamdown } from 'streamdown'
import ReactMarkdown from 'react-markdown'

/**
 * Wrapper of [streamdown](https://github.com/vercel/streamdown) that slightly adjusts the default spacing and text wrapping.
 */
export function Markdown(props: React.ComponentProps<typeof Streamdown> & { component?: typeof Streamdown | typeof ReactMarkdown }) {
    const { remarkPlugins, components, ...rest } = props
    const Component = props.component || Streamdown

    return (
        <Component
            remarkPlugins={[
                () => {
                    return (tree) => {
                        function addProp(node: any, prop: string, value: any) {
                            if (!node.data) {
                                node.data = {}
                            }
                            if (!node.data.hProperties) {
                                node.data.hProperties = {}
                            }
                            node.data.hProperties[prop] = value
                        }

                        let blockNodes = tree.children.filter((node: any) => ['paragraph', 'heading', 'list'].includes(node.type))
                        if (blockNodes.length > 0) {
                            const first = blockNodes[0]
                            if (first.type === 'paragraph' || first.type === 'heading') {
                                addProp(first, 'isFirst', true)
                            }
                        }

                        function markPartOfList(node: any) {
                            if (node.type === 'paragraph' || node.type === 'heading') {
                                addProp(node, 'isPartOfList', true)
                            }
                            if (node.children) {
                                node.children.forEach(markPartOfList)
                            }
                        }
                        tree.children.forEach((node: any) => {
                            if (node.type === 'list') {
                                node.children.forEach(markPartOfList)
                            }
                        })
                    }
                },
                ...(remarkPlugins || [])
            ]}
            components={{
                ...components,
                ...Object.fromEntries(
                    Array.from(new Array(6)).map((_, i) => {
                        return [
                            `h${i + 1}`,
                            (props2: React.PropsWithChildren<{ style?: React.CSSProperties }>) => {
                                const props3 = props2 as typeof props2 & { isFirst?: boolean; isPartOfList?: boolean }
                                const Component = (components && components[`h${i + 1}`]) || `h${i + 1}`
                                return (
                                    <Component
                                        style={{
                                            margin: `${props3.isFirst || props3.isPartOfList ? 0 : '0.75em'} 0 0 0`,
                                            whiteSpace: 'pre-wrap',
                                            overflowWrap: 'anywhere',
                                            display: props3.isPartOfList ? 'inline' : undefined
                                        }}
                                    >
                                        {props3.children}
                                    </Component>
                                )
                            }
                        ]
                    })
                ),
                p: (props2) => {
                    const props3 = props2 as typeof props2 & { isFirst?: boolean; isPartOfList?: boolean }
                    const Component = components?.p || 'p'
                    return (
                        <Component
                            style={{
                                margin: `${props3.isFirst || props3.isPartOfList ? 0 : '0.75em'} 0 0 0`,
                                whiteSpace: 'pre-wrap',
                                overflowWrap: 'anywhere',
                                display: props3.isPartOfList ? 'inline' : undefined
                            }}
                        >
                            {props3.children}
                        </Component>
                    )
                },
                ul: (props2) => {
                    const Component = components?.ul || 'ul'
                    return <Component style={{ paddingInlineStart: '1.3em' }}>{props2.children}</Component>
                },
                ol: (props2) => {
                    const Component = components?.ol || 'ol'
                    return <Component style={{ paddingInlineStart: '1.3em' }}>{props2.children}</Component>
                }
            }}
            {...rest}
        />
    )
}
