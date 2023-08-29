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
 *  Copyright(c) 2023 F4JDN - Jean-Michel Cohen
 *  
*/

import fs from 'fs'
import * as config from './config.js'

const GREEN     = '\x1b[92m'
const RED       = '\x1b[91m'
const ENDC      = '\x1b[0m'
const BOLD      = '\x1b[1m'
const CURSORON  = '\x1b[?25h'
const CURSOROFF = '\x1b[?25l'
const ERASEEOL  = '\x1b[0K'
const MARGIN    = 4

console.log(`\n${BOLD}Active Users Utility v1.0 (c) 2023 Jean-Michel Cohen, F4JDN <f4jdn@outlook.fr>${ENDC}`)
console.log(`\n${' '.repeat(MARGIN)}will create "${config.__path__}assets/active_users.json" using "${config.__log_path__}${config.__lastheard_file__}"`)

if (fs.existsSync(`${config.__log_path__}${config.__lastheard_file__}`)) {
  if (fs.existsSync(`${config.__path__}assets/users.json`)) {
    let users = JSON.parse(fs.readFileSync(`${config.__path__}assets/users.json`, 'utf-8'))['users']
    console.log(`\n${' '.repeat(MARGIN)}RadioId user file contains ${users.length} records`)

    // if available, add local subscribers
    if (fs.existsSync(`${config.__path__}local_subscriber_ids.json`)) {
      let local_subscribers = JSON.parse(fs.readFileSync(`${config.__path__}local_subscriber_ids.json`, 'utf-8'))['results']
      console.log(`${' '.repeat(MARGIN)}local_subscribers_ids file contains ${local_subscribers.length} records`)
      users = users.concat(local_subscribers)
      console.log(`${' '.repeat(MARGIN)}After merge users dictionary contains ${users.length} records`)
    }

    let traffic = JSON.parse(fs.readFileSync(`${config.__log_path__}${config.__lastheard_file__}`, 'utf-8'))['TRAFFIC']

    let trafficLength = traffic.length
    let singleUsers = new Set()
    let record = null
    let activeUsers: any[] = []
    let maxprogbarlength = 40
    let ratio = maxprogbarlength / trafficLength
    let t1 = Date.now() / 1000 - 1
    let elapsed: number = 0
    let speed: number = 0
    let eta: number = 0
    let green: number = 0
    let white: number = 0
  
    // prepare progression bar
    console.log(`${CURSOROFF}\r\nParsing the ${trafficLength} calls found in lastheard\n`)

    for(let i=0; i<trafficLength; i++) {
      elapsed = (Date.now() / 1000) - t1
      speed = Math.floor((i + 1) / elapsed)
      eta = Math.floor((trafficLength-i) / speed)
      green = Math.floor((i + 1) * ratio)
      white = Math.floor(maxprogbarlength - green)

      // print progression bar
      process.stdout.write(`${' '.repeat(MARGIN)}${GREEN}${'━'.repeat(green)}${ENDC}${'━'.repeat(white)}${(i+1).toString().padStart(6)}/${trafficLength} ${RED}${speed} rec/s${ENDC} eta ${eta}s${ERASEEOL}\r`)

      record = traffic[i]

      if (!singleUsers.has(record.DMRID)) {
        for(let j=0; j<users.length; j++) {
          if (users[j].id == record.DMRID) {
            singleUsers.add(record.DMRID)
            activeUsers.push(users[j])
            break
          }
        }
      }
    }

    console.log(`\n\nFound ${activeUsers.length} different OMs${CURSORON}\n`)

    fs.unlinkSync(`${config.__path__}assets/active_users.json`)
    fs.writeFileSync(`${config.__path__}assets/active_users.json`, JSON.stringify(activeUsers), "utf-8")
  }
}
