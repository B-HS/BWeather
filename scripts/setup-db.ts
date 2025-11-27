import { SQL } from 'bun'

const main = async () => {
    console.log('Setting up database...')

    const db = new SQL(
        `mysql://${process.env.MYSQL_USER}:${process.env.MYSQL_PASSWORD}@${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}/${process.env.MYSQL_DATABASE}`
    )

    const schemaFile = Bun.file('./db/schema.sql')
    const schema = await schemaFile.text()

    await db.unsafe(schema)

    console.log('Database setup complete!')
    await db.close()
}

main().catch((err) => {
    console.error('Database setup failed:', err)
    process.exit(1)
})
