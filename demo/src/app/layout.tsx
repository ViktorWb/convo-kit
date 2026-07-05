import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'LLM React Demo',
    description: 'Demo'
}

export default function ({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <main style={{ padding: '2em' }}>{children}</main>
            </body>
        </html>
    )
}
