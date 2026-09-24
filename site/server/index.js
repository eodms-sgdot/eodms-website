/*
 * Express Node.js backend.
 *
 * For testing only, AAA service is having difficulty with CORS issues. These methods only serve as a proxy and do no processing.
 */
const axios = require('axios')
const cors = require('cors')
const express = require('express')

const app = express()

app.use(cors())
app.use(express.json())

/*
 * POST - /login - Redirects a login POST request to the AAA service.
 */
app.post('/login', (req, res) => {

    // post to AAA endpoint
    axios.post(
        'https://eodms-sgdot.nrcan-rncan.gc.ca/aaa/v1/login',
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
 * GET - /refresh - Redirects a refresh GET request to the AAA service.
 */
app.get('/refresh', (req, res) => {

    // send to AAA endpoint
    axios.get(
        'https://eodms-sgdot.nrcan-rncan.gc.ca/aaa/v1/refresh',
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
 * Server listener
 */
app.listen(5000, () =>{
    console.log('server listening on 5000')
})