export const metadata = {
  title: 'SynCal',
  description: 'Self-hosted calendar synchronization portal'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
