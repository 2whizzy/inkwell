// Vercel serverless function: fetch a URL server-side so the browser can
// bypass CORS, then hand the raw HTML back for client-side Readability parsing.
export default async function handler(req, res) {
  const url = req.query?.url
  if (!url || !/^https?:\/\//i.test(url)) {
    res.status(400).send('Provide a valid http(s) url query param.')
    return
  }
  try {
    const upstream = await fetch(url, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })
    if (!upstream.ok) {
      res.status(502).send(`Upstream responded ${upstream.status}`)
      return
    }
    const html = await upstream.text()
    res.setHeader('content-type', 'text/plain; charset=utf-8')
    res.setHeader('cache-control', 's-maxage=86400')
    res.status(200).send(html)
  } catch (err) {
    res.status(500).send(`Fetch failed: ${err?.message || 'unknown error'}`)
  }
}
