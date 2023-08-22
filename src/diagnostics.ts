/*
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the "Software"), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 *
 *  Copyright(c) 2023 F4JDN - Jean-Michel Cohen
 *  
*/

import os from "os"
import * as net from 'net'
import * as config from "./config.js"
import { logger } from "./monitor.js"
import { exec } from "child_process"

export let __diag_table__: any = []

export class Diagnostics {
  private pending = false
  private counter: number = 0

  constructor() {
  }

  setResult(item: any) {
    for(let i=0; i < __diag_table__.length; i++) {
      if (__diag_table__[i].NAME == item.NAME  && __diag_table__[i].ACTION == item.ACTION ) {
        __diag_table__[i]['STATUS'] = item.STATUS

        if (item.ACTION == "ping")
          __diag_table__[i]['TIME'] = item.TIME

        return
      }
    }

    __diag_table__.push(item)
  }

  async checkServer(__diag_table__: any, server: any) {
    try {
      if (server.action == 'connect') {
        const execRun = (socket: any) => {
          return new Promise((resolve, reject) => {

            setTimeout(() => {
              socket.destroy();
              resolve(0)
            }, socket.timeout)

            socket.on('error', () => {
              resolve(-1)
            })

            try {
              socket.connect(server.port, server.ip, () => {
                resolve(1)
              })
            }
            catch(e) {
              logger.info(e.toString())
              socket.end()
              resolve(-1)
            }
          })
        }

        (async () => {
          try {
            const timeout = 2000; // Set a timeout for the connection attempt (2 seconds)      
            const socket = new net.Socket()
            socket.setTimeout(timeout) // Set a timeout for the connection attempt

            const testing = await execRun(socket)

            socket.end()
            this.setResult( { 'ORDER': server.order, 'NAME': server.name, 'TYPE': server.type, 'ACTION': server.action, 'STATUS': testing })
          } catch (e) {
            this.setResult( { 'ORDER': server.order, 'NAME': server.name, 'TYPE': server.type, 'ACTION': server.action, 'STATUS': -1 })
          }
        })()

        return
      }

      if (server.action == 'ping') {
        let ping_time = 0

        const execRun = (cmd: string) => {
          return new Promise((resolve, reject) => {
            // console.log(cmd)

            exec(cmd, (error, stdout, stderr) => {
              if (error) {
                if (error.code === 1) {
                  try {
                    ping_time = parseFloat(stdout.split('time=')[1].split(' ')[0])
                    ping_time *= 1.000 // Convert to milliseconds
                    resolve(ping_time.toFixed(2))
                  }
                  catch(e) {
                    console.log(stdout)
                    resolve(-1)
                  }
                } else {
                  resolve(-1)
                }
              } else {
                try {
                  ping_time = parseFloat(stdout.split('time=')[1].split(' ')[0])
                  ping_time *= 1.000 // Convert to milliseconds
                  resolve(ping_time.toFixed(2))
                }
                catch(e) {
                  console.log(stdout)
                  resolve(-1)
                }
              }
            })
          })
        }
        
        (async () => {
          try {
            const testing = await execRun(`ping ${ os.platform() === 'win32' ? '-n 1' : '-c 1'} ${server.ip}`)
            this.setResult( { 'ORDER': server.order, 'NAME': server.name, 'TYPE': server.type, 'ACTION': server.action, 'TIME': testing, 'STATUS': 0 })
          } catch (e) {
            this.setResult( { 'ORDER': server.order, 'NAME': server.name, 'TYPE': server.type, 'ACTION': server.action, 'TIME': -1, 'STATUS': -1 })
          }
        })()
      }

      // https://stackoverflow.com/questions/61231106/why-is-my-exec-command-failing-but-works-if-the-command-is-passed-in-the-termina
      if (server.action == 'service') {
        if (os.platform() !== 'win32') {

          const execRun = (cmd: string) => {
            return new Promise((resolve, reject) => {
              exec(cmd, (error, stdout, stderr) => {

                if (error) {
                  if (error.code === 1) {
                    resolve((stdout.toString().trim() === 'active') ? 1 : 0)
                  } else {
                    resolve((stdout.toString().trim() === 'inactive') ? 0 : -1)
                  }
                } else {
                  resolve((stdout.toString().trim() === 'active') ? 1 : 0);
                }
              })
            })
          }
          
          (async () => {
            try {
              const testing = await execRun(`systemctl is-active ${server.service}`)
              this.setResult( { 'ORDER': server.order, 'NAME': server.name, 'TYPE': server.type, 'ACTION': server.action, 'STATUS': testing })
            } catch (e) {
              this.setResult( { 'ORDER': server.order, 'NAME': server.name, 'TYPE': server.type, 'ACTION': server.action, 'STATUS': -1 })
            }
          })()
        }
        else
          this.setResult( { 'ORDER': server.order, 'NAME': server.name, 'TYPE': server.type, 'ACTION': server.action, 'STATUS': -2 })
      }
    }
    catch(e) {      
    }
  }

  async runCheck() {
    if (!this.pending) {
      this.pending = true

      const serverStatusPromises = config.__to_be_monitored__.map((server) => { 
        this.checkServer(__diag_table__, server)
      })

      Promise.all(serverStatusPromises)
      .then(dataArray => { 
        this.pending = false
        // logger.info(`All data fetched ${this.counter++}: ${JSON.stringify(__diag_table__)}\n\n`)
      })
      .catch(error => { 
        this.pending = false
        console.error('Error:', error) 
      })
    }
  }
}
