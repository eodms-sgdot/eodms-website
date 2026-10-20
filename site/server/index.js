/*
 * Express Node.js backend.
 *
 * For testing only, AAA service is having difficulty with CORS issues. These methods only serve as a proxy and do no processing.
 */
const axios = require('axios')
const express = require('express')
const fs = require('node:fs')
const path = require('node:path')

const localEnvFile = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(localEnvFile)) process.loadEnvFile(localEnvFile)

const targetEnvironment = (process.env.EODMS_TARGET_ENV || 'staging').toLowerCase()
if (!['staging', 'production'].includes(targetEnvironment)) {
    throw new Error('EODMS_TARGET_ENV must be either staging or production')
}

const configuredDomain = targetEnvironment === 'production'
    ? process.env.EODMS_PRODUCTION_DOMAIN || 'https://eodms-sgdot.nrcan-rncan.gc.ca'
    : process.env.EODMS_STAGING_DOMAIN
if (!configuredDomain) {
    throw new Error('Set EODMS_STAGING_DOMAIN in site/.env.local for local staging AAA proxying')
}
const eodmsDomain = configuredDomain.replace(/\/+$/, '')

const app = express()

app.use(express.json())

/*
 * POST - /aaa/v1/login - Redirects a login POST request to the AAA service.
 */
app.post('/aaa/v1/login', (req, res) => {

    // post to AAA endpoint
    axios.post(
        `${eodmsDomain}/aaa/v1/login`,
        req.body
    ).then(response => {
        res.send(response.data) // return the entire response body
    }).catch(error => {
        // pass along partial data, as axios error also contains payload
        const status = error.response?.status || error.status || 500;
        res.status(status).send({'message' : error.message, 'code' : error.code, 'status' : error.status})
    })
})

/*
 * GET - /aaa/v1/refresh - Redirects a refresh GET request to the AAA service.
 */
app.get('/aaa/v1/refresh', (req, res) => {

    // send to AAA endpoint
    axios.get(
        `${eodmsDomain}/aaa/v1/refresh`,
        {
            headers: {Authorization : req.headers['authorization']}
        }
    ).then(response => {
        res.send(response.data) // return the entire response body
    }).catch(error => {
        // pass along partial data, as axios error also contains payload
        const status = error.response?.status || error.status || 500;
        res.status(status).send({'message' : error.message, 'code' : error.code, 'status' : error.status})
    })
})

/*
 * GET, PATCH - /aaa/v1/users/:username - Redirects user profile requests to the AAA service.
 */
const proxyUser = (req, res) => {
    axios.request({
        method: req.method,
        url: `${eodmsDomain}/aaa/v1/users/${encodeURIComponent(req.params.username)}`,
        headers: {Authorization : req.headers['authorization']},
        data: req.method === 'PATCH' ? req.body : undefined,
    }).then(response => {
        res.status(response.status).send(response.data)
    }).catch(error => {
        // Pass the upstream body through so validation messages reach the panel.
        const status = error.response?.status || error.status || 500;
        const retryAfter = error.response?.headers?.['retry-after'];
        if (retryAfter) res.set('Retry-After', retryAfter)
        res.status(status).send(error.response?.data ?? {'message' : error.message, 'code' : error.code, 'status' : error.status})
    })
}
app.get('/aaa/v1/users/:username', proxyUser)
app.patch('/aaa/v1/users/:username', proxyUser)

/*
 * Server listener
 */
app.listen(5000, () =>{
    console.log('server listening on 5000')
})