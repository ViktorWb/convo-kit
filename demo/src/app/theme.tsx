'use client'

import React from 'react'
import { Ubuntu } from 'next/font/google'
import { createTheme, MantineProvider } from '@mantine/core'

const ubuntuFont = Ubuntu({
    weight: ['300', '400', '500', '700'],
    subsets: ['latin']
})

const theme = createTheme({
    fontFamily: ubuntuFont.style.fontFamily,
    headings: {
        fontFamily: ubuntuFont.style.fontFamily,
        fontWeight: '500'
    }
})

export function ThemeProvider({ children }: React.PropsWithChildren<{}>) {
    return <MantineProvider theme={theme}>{children}</MantineProvider>
}
