import { Metadata } from 'next'
import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core'
import '@mantine/core/styles.css'
import { ThemeProvider } from './theme'
import { LayoutClient } from './layoutClient'

export const metadata: Metadata = {
    title: 'LLM React Demo',
    description: 'Demo'
}

export default function ({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" {...mantineHtmlProps}>
            <head>
                <ColorSchemeScript />
            </head>
            <body>
                <ThemeProvider>
                    <LayoutClient>{children}</LayoutClient>
                </ThemeProvider>
            </body>
        </html>
    )
}
