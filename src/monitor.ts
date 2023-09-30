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
import { WebSocketServer } from 'ws'

// import zlib from 'zlib'

import http from 'http'
import https from 'https'

import { Logger } from './logger.js'
import { Utils } from './utils.js'
import { FileDownloader } from './filedownloader.js'
import { Crc16 } from './crc16.js'

import { Reporter } from './reporter.js'
import * as rep from './reporter.js'
import * as globals from './globals.js'
import * as sessionmgr from './session.js'

import * as config from './config.js'

export let logger: Logger
export let utils: Utils
export let crc16: Crc16

let __siteLogo_html__: any = ''
let __buttonBar_html__: any = ''
let __footer_html__: any = ""

// system variables
const extensions: string[] = ['.ico', '.jpg', '.png', '.gif', '.css', '.js', '.mp3', '.mp4', '.webm', '.mpeg', '.ogg', '.ppt', '.pptx']

type LastHeardSchema = {
  datetime: string        // 00
  delay: string           // 01
  filler: string          // 02
  packet: string          // 03
  infra: string           // 04
  sourceid: string        // 05
  netid: string           // 06
  slot: string            // 07
  tgid: string            // 08
  logp: string            // 09
  dmrid: string           // 10
  callsign: string        // 11
  fname: string           // 12
}

export let __version__: string          = "1.9.0"
export let __sessions__: any[]          = []
export let __talkgroup_ids__            = null
export let __subscriber_ids__           = null
export let __mobilePhone__: boolean     = false
export let __currentPageMenuState__     = null

const loadTemplate = (filename: string): string => {
  return fs.readFileSync(filename, { encoding: 'utf8', flag: 'r' })
}

const replaceSystemStrings = (data: string): string => {
  if (data != null) {
    return data.replace('__THEME__',  config.__theme__)
                .replace('__SYSTEM_NAME__',  config.__system_name__)
                .replace('__SITE_LOGO__',  __siteLogo_html__)
                .replace('__VERSION__',  __version__)
                .replace('__FOOTER__',  __footer_html__)
                .replace('__BUTTON_BAR__',  __buttonBar_html__)
                .replace('__SOCKET_SERVER_PORT__',  `${config.__socketServerPort__}`)
                .replace('__PAGE_MENU_STATE__',  __currentPageMenuState__)
                .replace('__DISPLAY_LINES__',  `${config.__displayLines__}`)
                .replace('__TGID_FILTER__',  config.__tgFilter__)
                .replace('__TGID_ORDER__',  config.__tgidOrder__)
                .replace('__TGID_HILITE__',  config.__tgHilite__)
                .replace('__DYNAMIC_TG__',  `${config.__dynamicTg__}`)
                .replace('__HIDE_DMRID__',  config.__hideDmrId__)
                .replace('__DISPLAY_PERCENT__',  `${config.__displayPercent__}`)
                .replace('__LAST_ACTIVE_SIZE__',  `${config.__last_active_size__}`)
                .replace('__LAST_ACTIVE_TG__',  `${config.__lastActiveTg__}`)
                .replace('__TGID_COLORS__',  `${config.__tgid_colors__}`)
                .replace('__TGID_SETTINGS__',  config.__tgid_settings__)
                .replace('__START_TOT__',  `${config.__start_tot__}`)
                .replace('__BANNER_DELAY__',  `${config.__bannerDelay__}`)
                .replace('__TGID_BEACONS__',  config.__tgid_beacons__)
                .replace('__MOBILE__',  `${__mobilePhone__}`)
                .replace('__TRAFFIC_LAST_N_DAYS__',  `${config.__traffic_last_N_days__}`)
  }
  
  return data
}

export class Monitor {
  private __peer_ids__ = null 
  private __local_subscriber_ids__ = null
  private __local_talkgroup_ids__ = null
  private __contacts__ids__ = null
  private __traffic__ = []

  private dashboardServer: WebSocketServer = null
  private webServer = null
  private reporter = null
  
  constructor() {
  }

  /**
   * 
   * @param tgid: string
   * @returns boolean
   * 
   * accepts tgid, tgid*, and tgid..tgid interval
   */
  IsTgidAllowed(tgid: string) {
    if (config.tgid_allowed.length < 2)
      return true

    let pattern = null
    let index = -1
    
    for(let i=0; i < config.tgid_allowed.length; i++) {
      pattern = config.tgid_allowed[i]

      if (pattern == tgid)
        return true

      if ((index = pattern.indexOf('*')) != -1 && tgid.startsWith(pattern.substring(0, index)))
        return true

      if ((index = pattern.indexOf('..')) != -1) {
        if (parseInt(pattern.substring(0, index)) <= parseInt(tgid) && parseInt(tgid) <= parseInt(pattern.substring(index+2)))
          return true
      }
    }

    return false
  }

  /**
   * 
   * to be done https://objsal.medium.com/how-to-encode-node-js-response-from-scratch-ce520018d6
   * 
   */

  requestListener(req: any, res: any) {
    let pageMenuStates = null
    __currentPageMenuState__ = null

    try {
      var isIpad = !!req.headers['user-agent'].match(/iPad/);
      var isAndroid = !!req.headers['user-agent'].match(/Android/);

      if (__mobilePhone__ = (isIpad || isAndroid))
        logger.info(`mobile phone connection ${req.headers['user-agent']}`)
    }
    catch(e) {
      __mobilePhone__ = false
    }

    if (config.__web_auth__) {
      let authHeader = req.headers['authorization']

      if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic realm="ndmonitor"')
        res.writeHead(401, 'Content-Type', 'text/plain')
        res.end()
        return
      }

      if (authHeader.split(' ')[0] == 'Basic') {
        let decodedData = Buffer.from(authHeader.split(' ')[1], 'base64').toString()
        let [username, password] = decodedData.split(':')

        if (crc16.compute(username, config.__web_secret_key__).toString() != password) {
          res.setHeader('WWW-Authenticate', 'Basic realm="ndmonitor"')
          res.writeHead(401, 'Content-Type', 'text/html')
          res.end()
          return
        }
        
        /**
         * authenticated, add to session and continue
         */
        let requestip = '::1' ? '127.0.0.1':req.socket.remoteAddress.replace(/^.*:/, '')
        if (!sessionmgr.sessions.hasOwnProperty(requestip)) {
          // logger.info(`adding ipaddress to session ${requestip}`)
          sessionmgr.sessions[requestip] = new sessionmgr.Session(requestip, 0)
        }
      }
    }

    const acceptedEncodings = req.headers['accept-encoding'] || ''

    let index = req.url.toString().indexOf('https://www.qrz.com/lookup/')
    if (index != -1) {
      const getqrzimage = async (protocol: any, url: string, res:any): Promise<void> => {
        return new Promise<void>((resolve, reject) => {
          const request = protocol.get(url, (response: any) => {
            // res.writeHead(200, 'Content-Type', 'text/html')
            response.pipe(res)
          })
        })
      }

      const url = req.url.toString().substring(index)
      const protocol = !url.charAt(4).localeCompare('s') ? https : http
      getqrzimage(protocol, url, res)
      return
    }

    if (req.url.toString().endsWith('.json')) {
      let fileurl:string = req.url.toString()
      let filename: string = fileurl.substring(fileurl.lastIndexOf('/') + 1, fileurl.length)

      let filepath = `${config.__path__}assets/${filename}`

      try {
        const gpcValue = req.header('Sec-GPC')
  
        if (gpcValue === '1') {
          // signal detected, do something
          logger.info(`gpc request detected`)
        }
      }
      catch(e) {
      }
  
      if (!fs.existsSync(filepath)) {
        logger.error(`Error file ${filepath} doesn't exists`);
        res.statusCode = 500;
        res.end(`The requested file ${filename} doesn't exists`);
        return
      }

      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Length', fs.statSync(filepath).size);

      const fileStream = fs.createReadStream(filepath)

      // Send the JSON file in chunks
      let isFirstChunk = true
      fileStream.on('data', (chunk) => {
        // Send the chunk to the response
        res.write(chunk);
      })

      fileStream.on('end', () => {
        res.end()
      })

      // Handle any errors that might occur during streaming
      fileStream.on('error', (err) => {
        logger.error(`Error reading the file: ${err}`);
        res.statusCode = 500;
        res.end('Internal Server Error');
      })

      return
    }

    let error404 = (res: any) => {
      fs.promises.readFile(`${config.__path__}pages/error404.html`)
      .then(content => {
        res.writeHead(404, 'Content-Type', 'text/html')
        res.end(content)
      })
    }

    switch (req.url) {
      case '/':
      case '/index.html':
        if (pageMenuStates = config.__menubar_management__['index_template'])
          __currentPageMenuState__ = `'${pageMenuStates['state']}'`

        res.writeHead(200, "Content-Type", "text/html")
        res.end(replaceSystemStrings(loadTemplate(`${config.__path__}pages/index_template.html`)))
        break

      case '/bridges.html':
      case '/tginfo.html':
      case '/map.html':
      case '/log.html':
      case '/loglast.html':
      case '/subscribers.html':
      case '/index_tabs.html':
      case '/ccs7manager.html':
      case '/logbook.html':
        // https://stackoverflow.com/questions/17779744/regular-expression-to-get-a-string-between-parentheses-in-javascript
        var regExp = /\/([^.]+)\./
        var matches = regExp.exec(req.url)
        
        if (pageMenuStates = config.__menubar_management__[matches[1]])
          __currentPageMenuState__ = `'${pageMenuStates['state']}'`

        res.writeHead(200, "Content-Type", "text/html")
        res.end(replaceSystemStrings(loadTemplate(`${config.__path__}pages${req.url}`)))
        break;
  
      default:
        var dotOffset = req.url.lastIndexOf('.');
        if (dotOffset == -1 || !extensions.includes(req.url.substr(dotOffset))) {
          return error404(res)
        }

        var filetype = {
            '.html' :{ mimetype: 'text/html', folder: '/pages'},
            '.htm' : { mimetype: 'text/html', folder: '/pages'},
            '.ico' : { mimetype: 'image/x-icon', folder: '/images'},
            '.jpg' : { mimetype: 'image/jpeg', folder: '/images'},
            '.png' : { mimetype: 'image/png', folder: '/images'},
            '.gif' : { mimetype: 'image/gif', folder: '/images'},
            '.css' : { mimetype: 'text/css', folder: '/css' },
            '.mp3' : { mimetype: 'audio/mp3', folder: '/media' },
            '.mp4' : { mimetype: 'video/mp4', folder: '/media' },
            '.mpeg' :{ mimetype: 'video/mpeg', folder: '/media' }, 
            '.ogg' : { mimetype: 'video/ogg', folder: '/media' },
            '.webm' :{ mimetype: 'video/webm', folder: '/media' },
            '.ppt' : { mimetype: 'application/vnd.ms-powerpoint', folder: '/media' },
            '.pptx' :{ mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', folder: '/media' },
            '.js' :  { mimetype: 'text/javascript', folder: '/scripts' }
          } [ req.url.substr(dotOffset) ];
  
        let folder: string = filetype.folder;
        let mimetype: string = filetype.mimetype;
        let filename: string = req.url.toString()
  
        // any icon from old apple device
        if (filename.indexOf('apple-touch-icon') != -1)
          filename = "/apple-touch-icon.png"

        // if bitmap does not exist return site logo
        if (!fs.existsSync(`${config.__path__}${folder}${filename}`)) {
          if (folder === '/images')
            filename = '/sitelogo.png'
          else {
            res.writeHead(200, mimetype)
            res.end("")
            return
          }
        }

        try {
          fs.promises.readFile(`${config.__path__}${folder}${filename}`)
            .then(content => {
              res.writeHead(200, mimetype)
              res.end(content)
            }),
            (reason: any) => {
              return error404(res)
            }
        }
        catch(e) {
          return error404(res)        
        }
      break
    }
  }

  findInSet = (pred: any, set: any) => { 
    for (let item of set) if(pred(item)) return item
  }

  completeMissingData(callsign: string, name: string, dmrid: string): any {
    if (dmrid.length > 6) {
      for(let i=0; i<__subscriber_ids__.length; i++) {
        if (__subscriber_ids__[i][dmrid])
          return __subscriber_ids__[i][dmrid]
      }
    }
    
    return { 'CALLSIGN': callsign, 'NAME': name, 'DMRID': dmrid }
  }

  parseLogfile(sorting: boolean): any[] {
    let jsonArray: any[] = []
    let counter = 0

    // if lastheard.log does not exists, create empty lastheard.json file
    if (!fs.existsSync(`${config.__log_path__}${config.__lastheard_log__}`))
      return jsonArray

    // else try to create a json file from the log file
    const allFileContents = fs.readFileSync(`${config.__log_path__}${config.__lastheard_log__}`, 'utf-8')

    const logfile = allFileContents.split(/\r?\n/)

    // start from the end to keep the last traffic
    for(let i=logfile.length-1; i>-1 && counter < config.__traffic_size__; i--) {
      var line = logfile[i]

      if (line.length > 0) {
        var row = line.split(',')

        let report_tgid: string = row[8].substring(2)

        if (this.IsTgidAllowed(report_tgid)) {
          // add endinf fname if missing
          if (row.length < 13)
            row.push('---')

          try {
            counter++

            let callsign = row[11].trim()
            let name = row[12].trim()

            if (!callsign.length || !name.length) {
              let record = this.completeMissingData(row[11].trim(), row[12].trim(), row[10].trim())

              if (!callsign.length)
                callsign = record.CALLSIGN

              if (!name.length)
                name = record.NAME
            }

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
              'CALLSIGN': callsign,
              'NAME':     name,
              'DELAY':    row[1]
            })
          }
          catch(e) {
            console.log(e)
          }
        }
      }
    }

    if (sorting) {
      // generic comparison function
      let cmp = (x: any, y: any) => {
        return x > y ? 1 : x < y ? -1 : 0
      }

      jsonArray.sort((a: any, b:any) => {
        // note the minus before -cmp, for descending order
        return cmp( 
            [cmp(a.DATE, b.DATE), cmp(a.TIME, b.TIME)], 
            [cmp(b.DATE, a.DATE), cmp(b.TIME, a.TIME)]
        )
      })
    }

    return jsonArray
  }
  
  /**
   * 
   * createLogTableJson()
   * 
   * @returns jsonified log file
   */
  createLogTableJson() {
    let jsonArray: any[] = []
    let counter: number = 0

    // if lastheard.log does not exists, create empty lastheard.json file
    if (!fs.existsSync(`${config.__log_path__}${config.__lastheard_log__}`)) {
      fs.writeFileSync(`${config.__log_path__}${config.__lastheard_file__}`, JSON.stringify({ 'TRAFFIC': jsonArray }), { encoding:'utf-8', flag:'w' })
      return jsonArray
    }

    // if lastheard.json exists, return the file content
    if (fs.existsSync(`${config.__log_path__}${config.__lastheard_file__}`))
      return JSON.parse(fs.readFileSync(`${config.__log_path__}${config.__lastheard_file__}`, 'utf-8'))['TRAFFIC']

    jsonArray = this.parseLogfile(false)

    fs.writeFileSync(`${config.__log_path__}${config.__lastheard_file__}`, JSON.stringify({ 'TRAFFIC': jsonArray }), { encoding:'utf-8', flag:'w' })

    if (config.__loginfo__)
      logger.info('Lastheard.json created and saved')

    return { jsonArray }
  }
  
  loadTraffic() {
    // clear array
    this.__traffic__ = []

    if (!fs.existsSync(`${config.__log_path__}${config.__lastheard_file__}`)) {
      this.createLogTableJson()
      // return
    }
  
    try {
      let record = null
      let rawdata = JSON.parse(fs.readFileSync(`${config.__log_path__}${config.__lastheard_file__}`, 'utf-8'))['TRAFFIC']
      rawdata.slice(Math.max(rawdata.length -  config.__lastheard_size__, 1))
  
      // remove all previous START packet if any
      for(let i=0; i < rawdata.length; i++) {
        record = rawdata[i]
        if (this.IsTgidAllowed(record['TGID'])) {
          if (record['PACKET'] !== 'START')
            this.__traffic__.push(record)
          else {
						var tt = new Date(record.DATE + " " + record.TIME);
						// if START below TOT add it
						if ((Date.now() - tt.getTime()) / 1000 < config.__start_tot__)
              this.__traffic__.push(record)
          }
        }
      }
    }
    catch(e) {
    }
  }

/**
 * disconnect dashboard clients after config.__client_timeout__ seconds
 */
  timeout_clients() {
    let now = Date.now() / 1000

    try {
      this.dashboardServer.clients.forEach((client: any) => {
        if (now - client.connectTime /1000 > config.__client_timeout__) {
          logger.info(`TIMEOUT: disconnecting client ${client}`)
          try {
            client.close()
          }
          catch(e) {
            logger.error(`Exception caught parsing client timeout ${e.toString()}`)
          }
        }
      })
    }
    catch(e) {
      logger.info('CLIENT TIMEOUT: List does not exist, skipping. If this message persists, contact the developer')
    }
  }

  // 'radioid', 'https://database.radioid.net/static/users.json');
  // 'Francophonie', 'http://francophonie.link/local_subscriber_ids.json');
  fetchRemoteUsersFiles(fileurl: string) {
    if (fileurl != '') {
      logger.info(`requesting: ${fileurl}`)

      let filename = fileurl.substring(fileurl.lastIndexOf('/') + 1, fileurl.length)
      let filepath = `${config.__path__}assets/${filename}`

      // local_subscriber_ids.json is in root folder
      if (filename == 'local_subscriber_ids.json') {
        if (fs.existsSync(`${config.__path__}${filename}`))
            return filename

        return ''
      }

      if (filename == 'active_subscriber_ids.json') {
        if (fs.existsSync(`${config.__path__}assets/${filename}`))
          return filename

        return ''
      }

      const downloader = new FileDownloader()
      const envFiles: any[] = [  { path:  `${config.__path__}assets/`, file:  filename, url:  fileurl, stale:  5 * 24 * 3600 } ]
  
      downloader.downloadAndWriteFiles(envFiles).then(() => {
        logger.info('File downloaded and saved.\n')  
        return filepath
      }).catch(err => {
        return ''
      })
    }
  }

  init() {
    logger = new Logger()
    utils = new Utils()
    crc16 = new Crc16()

    try {
      // create assets folder if needed
      if (!fs.existsSync(config.__log_path__))
        fs.mkdirSync(config.__log_path__)
    } 
    catch (err) {
    }

    /** 
     * https://manytools.org/hacker-tools/ascii-banner/
     */ 
    logger.info(`${globals.__CLEAR__}${globals.__HOME__}`)

    logger.info(`${globals.__BLUE__}    dMMMMb  dMMMMb         ${globals.__WHITE__}dMMMMMMMMb  .aMMMb  dMMMMb  ${globals.__RED__}dMP dMMMMMMP .aMMMb  dMMMMb`)
    logger.info(`${globals.__BLUE__}   dMP dMP dMP VMP        ${globals.__WHITE__}dMP"dMP"dMP dMP"dMP dMP dMP ${globals.__RED__}amr    dMP   dMP"dMP dMP.dMP`)
    logger.info(`${globals.__BLUE__}  dMP dMP dMP dMP        ${globals.__WHITE__}dMP dMP dMP dMP dMP dMP dMP ${globals.__RED__}dMP    dMP   dMP dMP dMMMMK`)
    logger.info(`${globals.__BLUE__} dMP dMP dMP.aMP        ${globals.__WHITE__}dMP dMP dMP dMP.aMP dMP dMP ${globals.__RED__}dMP    dMP   dMP.aMP dMP"AMF`) 
    logger.info(`${globals.__BLUE__}dMP dMP dMMMMP"        ${globals.__WHITE__}dMP dMP dMP  VMMMP" dMP dMP ${globals.__RED__}dMP    dMP    VMMMP" dMP dMP`)
    
    logger.info(`${globals.__RESET__}`)
    
    logger.info(`\nNDMonitor v${__version__} (c) 2023 Jean-Michel Cohen, F4JDN <f4jdn@outlook.fr>`
    + '\nBased on HBMonitor 2019-2021 by Waldek, SP2ONG'
    + '\nBased on Python 3 version 2019 by Steve Miller, KC1AWV <smiller@kc1awv.net>')

    if (config.testMode)
      logger.info(`\n${globals.__ORANGE__}BEWARE!!!!! You are running in test mode${globals.__RESET__}`)

    /**
     * Download files
     */
    const downloader = new FileDownloader()
    const envFiles: any[] = [ 
      { path:  config.__path__, file:  config.__local_subscriber_file__, url:  config.__local_subscriber_url__, stale:  config.__file_reload__ * 24 * 3600 },
      { path:  config.__path__, file:  config.__peer_file__, url:  config.__peer_url__, stale:  config.__file_reload__ * 24 * 3600 },
      { path:  config.__path__, file:  config.__subscriber_file__, url:  config.__subscriber_url__, stale:  config.__file_reload__ * 24 * 3600 }
    ]

    logger.info('\nStarting files download, be patient, it could take several minutes...')

    downloader.downloadAndWriteFiles(envFiles).then(() => {
        logger.info(`\nAll files downloaded and saved. ${globals.__OK__}`)

        logger.info(`\nBuilding dictionaries`)

        // making peers dictionary
        this.__peer_ids__ = utils.mk_full_id_dict(config.__path__, config.__peer_file__, 'peer')
        if (this.__peer_ids__)
          logger.info('ID ALIAS MAPPER: peer_ids dictionary is available')

        // making subscribers dictionary
        __subscriber_ids__  = utils.mk_full_id_dict(config.__path__, config.__subscriber_file__, 'subscriber')
        if (__subscriber_ids__)
          logger.info('ID ALIAS MAPPER: subscriber_ids dictionary is available')
        
        // making local subscribers dictionary
        this.__local_subscriber_ids__ = utils.mk_full_id_dict(config.__path__, config.__local_subscriber_file__, 'subscriber')
        if (this.__local_subscriber_ids__) {
          logger.info('ID ALIAS MAPPER: local_subscriber_ids dictionary is available')
    
          // merging subscribers global & local dictionaries
          if (__subscriber_ids__) {
            __subscriber_ids__ = __subscriber_ids__.concat(this.__local_subscriber_ids__)
            logger.info('ID ALIAS MAPPER: local_subscriber_ids merged to subscriber_ids dictionary')
          }
        }
                  
        // making talkgroups dictionary
        __talkgroup_ids__ = utils.mk_full_id_dict(config.__path__, config.__tgid_file__, 'tgid')
        if (__talkgroup_ids__)
          logger.info('ID ALIAS MAPPER: talkgroup_ids dictionary is available')
        
        // making local talkgroups dictionary
        this.__local_talkgroup_ids__ = utils.mk_full_id_dict(config.__path__, config.__local_tgid_file__, 'tgid')
        if (this.__local_talkgroup_ids__) {
          logger.info('ID ALIAS MAPPER: local_subscriber_ids dictionary is available')
    
          /**
           * Merge talkgroups global & local
           */
          if (__talkgroup_ids__) {
            __talkgroup_ids__ = __talkgroup_ids__.concat(this.__local_talkgroup_ids__)
            logger.info('ID ALIAS MAPPER: local_talkgroup_ids merged to talkgroup_ids dictionary')
          }          
        }

        if (fs.existsSync(`${config.__log_path__}contacts_fr_dept.json`)) {
          try {
            this.__contacts__ids__ = JSON.parse(fs.readFileSync(`${config.__log_path__}contacts_fr_dept.json`).toString())
            logger.info('ID CONTACTS: contacts_fr_dept.json dictionary is available')
          }
          catch(e) {    
          }    
        }
      
        logger.info(`\nDictionaries completed ${globals.__OK__}\n`)

        // must be first
        __footer_html__ = replaceSystemStrings(loadTemplate(`${config.__path__}pages/${config.__footer__}`))        

        __siteLogo_html__ = replaceSystemStrings(loadTemplate(`${config.__path__}pages/${config.__siteLogo__}`))
        __buttonBar_html__ = replaceSystemStrings(loadTemplate(`${config.__path__}pages/${config.__buttonBar__}`))

        try {
          this.loadTraffic()
          logger.info(`\nlastheard contains ${this.__traffic__.length} records`)
        }
        catch(e) {
          logger.info(`\nError reading ${config.__log_path__ + config.__lastheard_file__}`)
        }

        /**
         * dashboard websocket server
         * 
         * create socket server https://github.com/websockets/ws#simple-server
         */
        try {
          logger.info(`creating dashboard socket server on port:${config.__socketServerPort__}`)
          
          this.dashboardServer = new WebSocketServer({ 
            port: config.__socketServerPort__,
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

          logger.info(`dashboard socket server created ${config.__socketServerPort__} ${globals.__OK__}\n`)

          try {
            let reporterServer: string = config.testMode ? config.hblink_server_host : 'localhost'
            this.reporter = new Reporter(monitor, reporterServer, config.hblink_server_port)
            // logger.info(`connection to HBlink/FreeDMR reporting socket ${globals.__OK__}`)
          }
          catch(e) {
            logger.info(`Error creating Report ${e.toString()}`)
          }

          if (config.__client_timeout__) {
            try {
              setInterval(() => {
                this.timeout_clients()
              }, 10000)

              logger.info(`vulture activated at a ${10}s interval\n`)
            }
            catch(e) {
              logger.info(`Error in vulture activation: ${e.toString()}`)
            }
          }

          this.dashboardServer.on('connection', (ws: any, req: any) => {
            let _message: any = {}

            /**
            * get connection information (page name)
            * page name
            * 
            * save that into extra properties
            * page
            * fromPage (assume true)
            * connectTime
            */
            const urlParams = new URLSearchParams(req.url.substring(1));
            ws.page = urlParams.get('page') ? urlParams.get('page') : 'generic'
            ws.fromPage = true
            ws.connectTime = Date.now()

            // get ip address
            let requestip = '::1' ? '127.0.0.1':req.socket.remoteAddress.replace(/^.*:/, '')

            /** 
             * check if session management is already done by html
             * if not, means websocket direct connection
             */
            if (/*config.__web_auth__ &&*/ !sessionmgr.sessions.hasOwnProperty(requestip)) {
              /**
               * no yet registered in session
               * it is a direct connection
               * 
               * presume authentication invalid
               */
              let valid = false

              // check if we have an allowed__socket_clients list
              if (config.__allowed__socket_clients__ != null && config.__allowed__socket_clients__.length > 0) {
                // check if allowed
                for(let i=0; i<config.__allowed__socket_clients__.length; i++) {
                  let item = config.__allowed__socket_clients__[i]
                  if (item.ipaddress == requestip) {
                    if ((item.id == '*' || item.id == ws.page) && (item.lease == '*' || (86400 * parseInt(item.lease)) > Date.now())) {
                      valid = true
                      ws.fromPage = (item.id != ws.page)
                      break
                    }
                  }
                }
              } else {
                // allow all
                valid = true
                ws.fromPage = false
              }

              if (!valid) {
                ws.terminate()
                logger.info(`\n\x1b[0;92mWARNING\x1b[0m Unauthenticated WebSocket from '${requestip}' connection rejected`)
                return
              }
            }

            logger.info(`\nWebSocket connection from page ${ws.page}`)
      
            // update ipmap table
            this.reporter.mapIpAdresses()

            // prepare initial packet            
            if (ws.fromPage) {
              if (ws.page === 'dashboard') {
                _message['CTABLE'] = rep.__ctable__
                _message['EMPTY_MASTERS'] = config.__empty_masters__
              }
              
              _message['BIGEARS'] = this.dashboardServer.clients.size.toString()
              _message['LISTENERS'] = rep.__listeners__

              if (ws.page === 'map')
                _message['CONTACTS'] = this.__contacts__ids__

              _message['DIAGNOSTICS'] = this.reporter.build_Diagnostic_table()
            }

            _message['PACKETS'] = {}

            let initialList: any[] = []

            if (fs.existsSync(`${config.__log_path__}lastheard.json`)) {
              // https://www.freecodecamp.org/news/how-to-clone-an-array-in-javascript-1d3183468f6a/

              initialList = [...this.__traffic__]

              // generic comparison function
              // let cmp = (x: any, y: any) => {
              //   return x > y ? 1 : x < y ? -1 : 0
              // }

              // initialList.sort((a: any, b:any) => {
              //   // note the minus before -cmp, for descending order
              //   return cmp( 
              //       [-cmp(a.DATE, b.DATE), -cmp(a.TIME, b.TIME)], 
              //       [-cmp(b.DATE, a.DATE), -cmp(b.TIME, a.TIME)]
              //   )
              // })

              if (config.__traffic_last_N_days__ > 0) {
                for(let i=0; i<initialList.length && i<config.__traffic_size__; i++) {
                  var t = new Date(initialList[i].DATE + ' 00:00:00')

                  if ((Date.now() - t.getTime()) / 1000 / 86400 >= config.__traffic_last_N_days__) {
                    initialList.length = i
                    break
                  }
                }
              }
              else {
                initialList.length = Math.min(initialList.length, config.__traffic_size__)
              }

              if (ws.fromPage) {
                switch(ws.page) {
                  case 'tginfo':
                  case 'bridges':
                  case 'loglast':
                    break

                  case 'logbook':
                    _message['PACKETS'] = { 'TRAFFIC': this.parseLogfile(true) }
                    break

                  default:
                    _message['PACKETS'] = { 'TRAFFIC': initialList }
                    break
                }
              }
            }

            ws.on('error', console.error)
      
            ws.on('message', (payload: any) => {
              // update time
              ws.connectTime = Date.now()

              if (config.__loginfo__)
                logger.info(`command received: ${payload}`)

              let _command = JSON.parse(payload)

              if (ws.fromPage && _command != null) {
                if (_command.hasOwnProperty('request')) {
                  if (_command['request'] === 'subscribers') {
                    if (fs.existsSync(config.__local_subscriber_file__))
                      ws.send(JSON.stringify({ 'SUBSCRIBERS': JSON.parse(loadTemplate(config.__local_subscriber_file__)).results }))
                    else
                      ws.send(JSON.stringify({ 'SUBSCRIBERS': {} }))
                  }
                  else
                  if (_command['request'] === 'loglast')
                    ws.send(JSON.stringify({ 'LOGLAST': this.createLogTableJson() }))
                }
                else {
                  if (_command.hasOwnProperty('fileurl') && _command['fileurl'].toString().startsWith('http')) {
                    let fileurl = _command['fileurl']                    
                    if (fileurl != '') {
                      logger.info(`requesting: ${fileurl}`)
                
                      let filename = fileurl.substring(fileurl.lastIndexOf('/') + 1, fileurl.length)
                      let filepath = `${config.__path__}assets/${filename}`
                
                      const downloader = new FileDownloader()
                      const envFiles: any[] = [  { path:  `${config.__path__}assets/`, file:  filename, url:  fileurl, stale: 86400 * 5 } ]
                  
                      downloader.downloadAndWriteFiles(envFiles).then(() => {
                        logger.info(`ccs7manager ${filename} downloaded and saved.\n`)
                        ws.send(JSON.stringify({ 'FILENAME': filename }))
                      }).catch(err => {
                        logger.info(`ccs7manager download request error ${filename}`)
                      })
                    }
                  }
                }
              }
            })

            ws.on('close', () => {
              let requestip = '::1' ? '127.0.0.1':req.socket.remoteAddress.replace(/^.*:/, '')
              if (config.__web_auth__ && sessionmgr.sessions.hasOwnProperty(requestip))
                delete sessionmgr.sessions[requestip]
            })
      
            ws.send(JSON.stringify({ 'CONFIG': _message}))
          })

          try {
            let hostServer: string = config.testMode ? 'localhost':config.hblink_server_host
            this.webServer = http.createServer(this.requestListener)
            this.webServer.listen(config.__monitor_webserver_port__, hostServer, () => {
              logger.info(`Web server is running on ${hostServer}:${config.__monitor_webserver_port__}`)
            })
          }
          catch(e) {
            logger.info(`Error in webserver creation: ${e.toString()}`) 
          }
        }
        catch(e) {
          logger.info(`Error creating WebSocketServer: ${e.toString()}`)
        }
      })
      .catch((e) => {
        logger.info(`An error during initialization: ${e.toString()}`)
      })
  }
}

const monitor: Monitor = new Monitor()
monitor.init()
