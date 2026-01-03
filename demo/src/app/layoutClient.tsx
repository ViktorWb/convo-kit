'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Tabs } from '@mantine/core'

export function LayoutClient(props: React.PropsWithChildren<{}>) {
    const pathname = usePathname()
    const router = useRouter()

    return (
        <>
            <Tabs value={pathname.split('/')[1] || 'md'} onChange={(newTab) => router.push(newTab === 'md' ? '/' : `/${newTab}`)}>
                <Tabs.List>
                    <Tabs.Tab value="md">Markdown</Tabs.Tab>
                    <Tabs.Tab value="chat">Chat UI</Tabs.Tab>
                    <Tabs.Tab value="fullscreen-chat">Fullscreen chat UI</Tabs.Tab>
                    <Tabs.Tab value="infinite">Infinite stream</Tabs.Tab>
                </Tabs.List>
            </Tabs>
            <main style={{ padding: '2em' }}>{props.children}</main>
        </>
    )
}
