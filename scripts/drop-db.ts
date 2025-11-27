import { SQL } from 'bun'

const main = async () => {
    console.log('Dropping weather tables...')

    const db = new SQL(
        `mysql://${process.env.MYSQL_USER}:${process.env.MYSQL_PASSWORD}@${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}/${process.env.MYSQL_DATABASE}`
    )

    await db.unsafe('DROP TABLE IF EXISTS weather_current')
    await db.unsafe('DROP TABLE IF EXISTS weather_ultra')
    await db.unsafe('DROP TABLE IF EXISTS weather_short')

    console.log('Tables dropped!')
    await db.close()
}

main().catch((err) => {
    console.error('Drop tables failed:', err)
    process.exit(1)
})
