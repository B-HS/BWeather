import { SQL } from 'bun'

let db: SQL | null = null

export const getDb = () => {
    if (!db) {
        db = new SQL(
            `mysql://${process.env.MYSQL_USER}:${process.env.MYSQL_PASSWORD}@${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}/${process.env.MYSQL_DATABASE}`
        )
    }
    return db
}

export const closeDb = async () => {
    if (db) {
        await db.close()
        db = null
    }
}
