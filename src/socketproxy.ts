/*
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the'Software'), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 *
 *  Copyright(c) 2023-24 F4JDN - Jean-Michel Cohen
 *  
*/

import fs from 'fs'
import { WebSocketServer } from 'ws'
import { logger } from "./monitor.js"

import * as globals from "./globals.js"
import * as config from "./config.js"

export class SocketProxy {
  private proxyServer = null

  broadcast(payload: any) {
    if (this.proxyServer) {
      try {
        this.proxyServer.clients.forEach((client: any) => {
          client.send(payload)
        })
      }
      catch(e) {
        logger.info('error')
      }
    }
  }

  init() {
    this.proxyServer = new WebSocketServer({
      port: config.__proxyServerPort__,
      perMessageDeflate: {
        zlibDeflateOptions: {
          // See zlib defaults.
          chunkSize: 1024,
          memLevel: 7,
          level: 3
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024
        },
        // Other options settable:
        clientNoContextTakeover: true, // Defaults to negotiated value.
        serverNoContextTakeover: true, // Defaults to negotiated value.
        serverMaxWindowBits: 10, // Defaults to negotiated value.
        // Below options specified as default values.
        concurrencyLimit: 10, // Limits zlib concurrency for perf.
        threshold: 1024 // Size (in bytes) below which messages
        // should not be compressed if context takeover is disabled.
      }
    })

    logger.info(`proxy socket server created ${config.__proxyServerPort__} ${globals.__OK__}\n`)

    this.proxyServer.on('connection', (ws: any, req: any) => {
      let _message: any = {}

      ws.on('error', console.error)

      ws.on('message', (payload: any) => {
        try {
          this.broadcast(payload)
        }
        catch(e) {
          logger.info(`invalid json received : ${payload}`)
        }
      })

      ws.on('close', () => {
        ws.close()
        this.proxyServer = null
      })
    })
  }
}
