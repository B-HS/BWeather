import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { errorHandler, notFoundHandler } from '@middleware/error-handler'
import { apiTokenAuth } from '@middleware/auth'
import { sessionAuth } from '@middleware/session'
import { rateLimiter } from '@middleware/rate-limiter'
import { requestLogger } from '@middleware/request-logger'
import { authRateLimiter } from '@middleware/auth-rate-limiter'
import weather from '@routes/weather'
import locations from '@routes/locations'
import auth from '@routes/auth'
import user from '@routes/user'
import { weatherCache } from '@lib/weather-cache'

const app = new Hono()

app.use('*', logger())
app.use('*', cors())
app.use('*', errorHandler)

app.get('/', (c) => c.json({ message: 'BWeather API', version: '1.0.0' }))

app.get('/health', (c) => c.json({ status: 'ok' }))

app.use('/api/auth/*', authRateLimiter)
app.route('/api/auth', auth)

app.use('/api/weather/*', apiTokenAuth, rateLimiter, requestLogger)
app.route('/api/weather', weather)

app.use('/api/user/*', sessionAuth)
app.route('/api/user', user)

app.route('/api/locations', locations)

app.notFound(notFoundHandler)

const port = Number(process.env.PORT) || 3000

console.log(`Starting server on port ${port}...`)

const shutdown = () => {
    console.log('Shutting down gracefully...')
    weatherCache.stopCleanup()
    process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

export default {
    port,
    fetch: app.fetch,
}
