import { createClient } from '@libsql/client'
const client = createClient({ url: 'file:./data/dev.sqlite' })
try {
  const rs = await client.execute("SELECT count(*) as c FROM contact_field_templates;")
  console.log('dev.sqlite OK:', rs.rows[0].c)
} catch (e) {
  console.error('dev.sqlite ERR:', e.message)
}
