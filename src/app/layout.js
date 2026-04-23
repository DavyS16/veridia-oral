import './globals.css'

export const metadata = { title: 'Veridia' }

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Cardo:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-white text-gray-900 antialiased">{children}</body>
    </html>
  )
}
