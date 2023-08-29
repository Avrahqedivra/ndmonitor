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

const lasheardFile = `${config.__log_path__}${config.__lastheard_file__}`
const subscribersFile = `${config.__path__}subscriber_ids.json`
const localSubscribersFile = `${config.__path__}local_subscriber_ids.json`
const activeUsersFile = `${config.__path__}assets/active_users.json`

console.log(`\n${BOLD}Active Users Utility v1.1 (c) 2023 Jean-Michel Cohen, F4JDN <f4jdn@outlook.fr>${ENDC}`)
console.log(`\n${' '.repeat(MARGIN)}will create "${activeUsersFile}" using "${lasheardFile}"`)

if (fs.existsSync(`${lasheardFile}`)) {
  if (fs.existsSync(`${subscribersFile}`)) {
    let users = JSON.parse(fs.readFileSync(`${subscribersFile}`, 'utf-8'))['users']
    console.log(`\n${' '.repeat(MARGIN)}RadioId user file contains ${users.length} records`)

    // if available, add local subscribers
    if (fs.existsSync(`${localSubscribersFile}`)) {
      let local_subscribers = JSON.parse(fs.readFileSync(`${localSubscribersFile}`, 'utf-8'))['results']
      console.log(`${' '.repeat(MARGIN)}local_subscribers_ids file contains ${local_subscribers.length} records`)
      users = users.concat(local_subscribers)
      console.log(`${' '.repeat(MARGIN)}After merge users dictionary contains ${users.length} records`)
    }

    let traffic = JSON.parse(fs.readFileSync(`${lasheardFile}`, 'utf-8'))['TRAFFIC']

    let trafficLength       = traffic.length
    let singleUsers         = new Set()
    let record              = null
    let activeUsers: any[]  = []
    let maxprogbarlength    = 40
    let ratio               = maxprogbarlength / trafficLength
    let t1                  = Date.now()
    let elapsed: number     = 0
    let speed: number       = 0
    let eta: number         = 0
    let green: number       = 0
    let white: number       = 0
  
    // prepare progression bar
    console.log(`${CURSOROFF}\r\nParsing the ${trafficLength} calls found in lastheard\n`)

    // for each transmission in the lastheard file
    for(let i=0; i<trafficLength; i++) {

      // prepapre data for the progression bar
      elapsed = Date.now() - t1
      speed   = Math.floor(i * 1000 / elapsed)
      eta     = Math.floor((trafficLength-i) / speed)
      green   = Math.floor(i * ratio)
      white   = Math.floor(maxprogbarlength - green)

      // print progression bar
      process.stdout.write(`${' '.repeat(MARGIN)}${GREEN}${'━'.repeat(green)}${ENDC}${'━'.repeat(white)}${(i+1).toString().padStart(6)}/${trafficLength} ${RED}${speed} rec/s${ENDC} eta ${eta}s${ERASEEOL}\r`)

      // read the record from lastheard traffic
      record = traffic[i]

      // if the user dmrid is not already registered
      if (!singleUsers.has(record.DMRID)) {
        // find his record in the radioid json file
        for(let j=0; j<users.length; j++) {
          // if found in the radioid json file
          if (users[j].id == record.DMRID) {
            // flag him as registered
            singleUsers.add(record.DMRID)
            // add his rasioid record to the activeusers list
            activeUsers.push(users[j])
            // stop there, go to the next
            break
          }
        }
      }
    }

    console.log(`\n\nFound ${activeUsers.length} different OMs${CURSORON}\n`)

    // write/overwrite the file
    fs.writeFileSync(`${activeUsersFile}`, JSON.stringify(activeUsers), { encoding:'utf-8', flag:'w' })
  }
}
