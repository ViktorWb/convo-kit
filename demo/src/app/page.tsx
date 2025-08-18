'use client'

import { useEffect, useState } from 'react'
import { Flex, Text, Title } from '@mantine/core'
import { LlmMarkdown } from '@/../../'
import { MantineLlmMarkdown } from '@/../../mantine'

let text = `# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6

This is a paragraph

This is another paragraph

- List item 1
- *List item 2*
- **List item 3**
- ***List item 4***
- [List item 5](https://google.com)

1. List item 1
2. *List item 2*
3. **List item 3**
4. ***List item 4***
5. [List item 5](https://google.com)

[This is a link](https://google.com)

<div style="background-color: red; width: 100px; height: 100px;" />`
text = [text, text, text].join('\n\n')

export default function () {
    const [show, setShow] = useState(0)

    useEffect(() => {
        const interval = setInterval(() => {
            setShow((old) => old + 200)
        }, 450)
        return () => {
            clearInterval(interval)
        }
    }, [])

    return (
        <>
            <Text size="sm" maw="80ch">
                This demo shows the streaming markdown components. This streaming markdown component:
            </Text>
            <Text component="ul" size="sm" maw="80ch" my="1em">
                <li>
                    Renders partial markdown. For example, while Markdown is streaming links will be broken. These links are rendered as text and only made
                    clickable once the full link is present.
                </li>
                <li>Displays character-by-character for smoother appearance, even if the LLM service outputs large chunks.</li>
                <li>Applies a fade-in effect as content is added quickly.</li>
            </Text>
            <Flex gap="15em" wrap="wrap">
                <div>
                    <Title>Unstyled</Title>
                    <LlmMarkdown>{text.slice(0, show)}</LlmMarkdown>
                </div>
                <div>
                    <Title>Mantine styled</Title>
                    <MantineLlmMarkdown>{text.slice(0, show)}</MantineLlmMarkdown>
                </div>
            </Flex>
        </>
    )
}
