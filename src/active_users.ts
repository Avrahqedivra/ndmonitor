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
import * as config from './config.js'

const GREEN     = '\x1b[92m'
const RED       = '\x1b[91m'
const ENDC      = '\x1b[0m'
const BOLD      = '\x1b[1m'
const CURSORON  = '\x1b[?25h'
const CURSOROFF = '\x1b[?25l'
const ERASEEOL  = '\x1b[0K'
const MARGIN    = 4

const lasheardFile = `${config.__log_path__}${config.__lastheard_log__}`
const subscribersFile = `${config.__path__}subscriber_ids.json`
const localSubscribersFile = `${config.__path__}local_subscriber_ids.json`
const activeUsersFile = `${config.__path__}assets/active_users.json`

/**
   * 
   * createLogTableJson()
   * 
   * @returns jsonified log file
   */
function createLogTableJson(): any[] {
  let jsonArray = []
  let omset = new Set()

  // else try to create a json file from the log file
  const allFileContents = fs.readFileSync(lasheardFile, 'utf-8')

  const logfile = allFileContents.split(/\r?\n/)

  for(let i=logfile.length-1; i>-1; i--) {
    var line = logfile[i]

    if (line.length > 0) {
      var row = line.split(',')

      let report_tgid: string = row[8].substring(2)

      // add endinf fname if missing
      if (row.length < 13)
        row.push('---')

      try {
        jsonArray.push({
          'DATE':     row[0].substring(0, 10), 
          'TIME':     row[0].substring(11, 19), 
          'TYPE':     row[2].substring(6),        // remove 'GROUP ' string header
          'PACKET':   row[3],
          'SYS':      row[4], 
          'SRC_ID':   row[5],
          'TS':       row[7].substring(2), 
          'TGID':     report_tgid, 
          'ALIAS':    row[9], 
          'DMRID':    row[10], 
          'CALLSIGN': row[11].trim(),
          'NAME':     row[12].trim(), 
          'DELAY':    row[1]
        })
      }
      catch(e) {
        console.log(e)
      }
    }
  }

  return jsonArray
}

function calculateDailyGrowthRate(populationData) {
  const growthRateData = []

  for (let day = 1; day < populationData.length; day++) {
    const previousPopulation = populationData[day - 1]
    const currentPopulation = populationData[day]
    const populationChange = currentPopulation - previousPopulation
    let growthRate = 0

    if (previousPopulation == 0)
      growthRate = 0
    else
      growthRate = populationChange / previousPopulation;

    growthRateData.push({
      day: day,
      currentPopulation: currentPopulation,
      growthRate: growthRate
    })
  }

  return growthRateData;
}

let argv = process.argv.slice(2)
let tg: string = ''
if (argv.length == 1)
  tg = parseInt(argv[0]).toString()

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

    // let traffic = JSON.parse(fs.readFileSync(`${lasheardFile}`, 'utf-8'))['TRAFFIC']
    let traffic = createLogTableJson()

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

    // Example population data (replace with your data)
    let populationData      = [];
    let prevDate            = ""
  
    // prepare progression bar
    console.log(`${CURSOROFF}\r\nParsing the ${trafficLength} calls found in lastheard\n`)

    // for each transmission in the lastheard file
    for(let i=0; i<trafficLength; i++) {

      // prepapre data for the progression bar
      elapsed = Date.now() - t1
      speed   = i * 1000 / elapsed
      eta     = Math.floor((trafficLength-i) / speed)
      green   = i * ratio
      white   = maxprogbarlength - green

      // print progression bar
      process.stdout.write(`${' '.repeat(MARGIN)}${GREEN}${'━'.repeat(green)}${ENDC}${'━'.repeat(white)}${(i+1).toString().padStart(6)}/${trafficLength} ${RED}${Math.floor(speed)} rec/s${ENDC} eta ${eta}s${ERASEEOL}\r`)

      // read the record from lastheard traffic
      record = traffic[i]

      if (record.DATE != prevDate) {
        prevDate = record.DATE
        populationData.push(0)
      }

      // if the user dmrid is not already registered
      if (!singleUsers.has(record.DMRID) && (tg == record.TGID || tg == '')) {

        // find his record in the radioid json file
        for(let j=0; j<users.length; j++) {
          // if found in the radioid json file
          if (users[j].id == record.DMRID) {

            populationData[populationData.length-1]++

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

    let specialtg = tg == '' ? 'all TGs': `TG${tg}`

    console.log(`\n\nFound ${activeUsers.length} different OMs${CURSORON} on ${specialtg} over ${populationData.length} days\n`)

    const dailyGrowthRates = calculateDailyGrowthRate(populationData);

    dailyGrowthRates.forEach(data => {
      let str = `Day ${data.day.toString().padStart(2)}: Growth Rate ${data.growthRate.toFixed(2).toString().padStart(5)} New: ${data.currentPopulation.toString().padStart(3)}`
      console.log(`${' '.repeat(MARGIN)}${str.padEnd(36)}${'━'.repeat(data.currentPopulation/2)}`)
    })

    console.log('\n')

    // write/overwrite the file
    fs.writeFileSync(`${activeUsersFile}`, JSON.stringify(activeUsers), { encoding:'utf-8', flag:'w' })
  }
}
