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

import fs from "fs"
import netsocket from "net"

import { logger, __subscriber_ids__, __talkgroup_ids__, __peers_ids__, utils } from "./monitor.js"
import { NetStringReceiver } from "./lib/netstrings.js"
import { PickleParser } from "./lib/pickleparser.js"
import { Monitor } from "./monitor.js"

import * as globals from "./globals.js"
import * as config from "./config.js"
import * as diags from "./diagnostics.js"
import { Extra } from "./extracommand.js"

// Opcodes for reporting protocol to HBlink
enum Opcodes {
  CONFIG_REQ  = 0,
  CONFIG_SND,
  BRIDGE_REQ,
  BRIDGE_SND,
  CONFIG_UPD,
  BRIDGE_UPD,
  LINK_EVENT,
  BRDG_EVENT
}

export let __analytics__: any
export let __ctable__: any
export let __btable__: any = { 'BRIDGES':{} }
export let __bridges__: any
export let __listeners__: any[]
export let __bridges_rx__: string = null

let currentDiag: any = []

const TIME_INTERVALS = 24+1
const MAXTRIES: number = 5

// https://cs.lmu.edu/~ray/notes/jsnetexamples/
export class Reporter {
  private legalMasters = new Set(config.__legal_masters__)
  private opbNotAllowed = null
  private monitor = null
  private dashboardServer = null
  private diagnostics = null
  private extra:Extra = new Extra()
  private client = null
  private netstring = null
  private pickleparser = null
  private packetCount: number = 0
  private now = Date.now()
  private build_time = 0
  private status_time = 0
  private opbfilter = new Set(config.__opb_filter__)
  private intervalCleanTE = 3
  private reconnectTicker = null
  private reconnectTries = MAXTRIES
  private errorMode = false

  private dayPadding = 3
  private hourPadding = 2
  private minutePadding = 2
  private secondsPadding = 2

  /**
   * Return friendly elapsed time from time in seconds 
   */
  since(_time: number) {
    // elapsed time in seconds
    let elapsed = (Date.now() / 1000) - _time

    let hours: number   = Math.floor(elapsed/3600) % 24
    let days: number    = Math.floor(elapsed/86400)

    if (days) {
        return `${days.toString().padStart(this.dayPadding, '0')}d ${hours.toString().padStart(this.hourPadding, '0')}h`
    }

    let minutes: number = Math.floor(elapsed/60) % 60
    if (hours)
        return `${hours.toString().padStart(this.hourPadding, '0')}h ${minutes.toString().padStart(this.minutePadding, '0')}m`

    let seconds: number = Math.trunc(elapsed % 60)
    if (minutes)
        return `${minutes.toString().padStart(this.minutePadding, '0')}m ${seconds.toString().padStart(this.secondsPadding, '0')}s`

    return `${seconds.toString().padStart(this.secondsPadding, '0')}s`
  }

  /**
   * ReverseEndian
   * 
   * convert a string number "1234567" 
   * to binary utf-8 "\u0000\u0000\u0000\u0000"
   * 
   * @param peer 
   * @returns 
   */
  ReverseEndian(peer: string) {
    let buf = Buffer.alloc(4, 'latin1')
    buf.writeUInt32BE(parseInt(peer), 0)
    return buf.toString('latin1')
  }

  /**
   * Build diagnostic table
   * scanns a table of ip, services etc to check their state
   */
  build_Diagnostic_table() {
    this.now = Date.now()

    // update status every 10s
    if (this.now - this.status_time > 10000) {
      this.status_time = this.now

      if (this.diagnostics.pending)
        return currentDiag

      currentDiag = [...diags.__diag_table__].sort((a: any, b:any) => {
        // note the minus before -cmp, for descending order
        return a.ORDER > b.ORDER ? 1 : a.ORDER < b.ORDER ? -1 : 0
      })

      this.diagnostics.runCheck()
    }

    return currentDiag
  }

  /**
   * mapIpAdresses()
   * 
   * create a list of ip addresses connected to the dashbaord
   * and if possible name the ip using the masters data
   */

  mapIpAdresses() {
    if (config.__do_ipmap__) {
      try {        
        let known_ip = []

        for(let system in __ctable__['MASTERS']) {
          let ctabdata = __ctable__['MASTERS'][system]['PEERS']
          for (let peer in ctabdata) {
            
            let record = ctabdata[peer]
            
            if (record["CALLSIGN"] && record["IP"] && record["PORT"])
              known_ip.push({ [record["IP"].trim()] : { 'CALLSIGN': record["CALLSIGN"].trim(), 'IP': record["IP"].trim(), 'PORT': record["PORT"], 'NETID': peer } })
          }
        }

        __listeners__ = []

        this.dashboardServer.clients.forEach((client: any) => {
          // note the regex to remove the :fff:: header
          let hostip = client._socket.remoteAddress == '::1' ? '127.0.0.1':client._socket.remoteAddress.replace(/^.*:/, '')

          let found = false

          for(let i=0; i<known_ip.length; i++) {
            if (known_ip[i][hostip]) {
              found = true
              __listeners__.push(known_ip[i][hostip])
            }
          }

          if (!found) {
            __listeners__.push({ 'CALLSIGN': 'n/a', 'IP': hostip, 'PORT': config.__monitor_webserver_port__, 'NETID': 'n/a' })
          }
        })
      }
      catch(e) {
        __listeners__ = []
      }
    }
  }

  /**
   * check if legal master
   */
  isLegalMaster(id: string): any {
    if (config.__legal_masters__.length < 2)
      return [ true, '' ]

    let negate: boolean = false
    let pattern: string = null
    let index: number = -1
    let i: number = 0
    
    for(i=0; i < config.__legal_masters__.length; i++) {
      pattern = config.__legal_masters__[i].id

      // if negate note nagation, and get interval
      if (negate = pattern.startsWith('~'))
        pattern = pattern.substring(1)

      if (pattern == id)
        return [ !negate, config.__legal_masters__[i].class ]

      if ((index = pattern.indexOf('*')) != -1 && id.startsWith(pattern.substring(0, index)))
        return [ !negate, config.__legal_masters__[i].class ]

      if ((index = pattern.indexOf('..')) != -1) {
        if (parseInt(pattern.substring(0, index)) <= parseInt(id) && parseInt(id) <= parseInt(pattern.substring(index+2)))
          return [ !negate, config.__legal_masters__[i].class ]
      }
    }

    return [ false, 'msAlien' ]
  }

  /**
   * 
   * add new peer
   * 
   * _peer_conf uses indexes in utf-8 binary string format ie "\u0000\u0000\u0000\u0000"
   * _ctable_loc uses indexes in utf8 string format ie "1234567"
   * peer is a string representing a number
   * 
   * @param _peer_conf
   * @param _ctable_loc 
   * @param peer 
   */
  add_hb_peer(_peer_conf: any, _ctable_loc: any, peer: string) {
    _ctable_loc[peer] = {}
    
    let _ctable_peer = _ctable_loc[peer]
  
    // if the Frequency is 000.xxx assume it's not an RF peer, otherwise format the text fields
    // (9 char, but we are just software)  see https://wiki.brandmeister.network/index.php/Homebrew/example/php2
  
    if (_peer_conf['TX_FREQ'] == null || _peer_conf['RX_FREQ'] == null) {
      _ctable_peer['TX_FREQ'] = 'n/a'
      _ctable_peer['RX_FREQ'] = 'n/a'
    }
    else {
      if (Number.isInteger(_peer_conf['TX_FREQ'].trim()) && Number.isInteger(_peer_conf['RX_FREQ'].trim())) {
        if (_peer_conf['TX_FREQ'].substr(0,3) === '000' || _peer_conf['RX_FREQ'].substr(0,3) === '000') {
            _ctable_peer['TX_FREQ'] = 'n/a'
            _ctable_peer['RX_FREQ'] = 'n/a'
        } else {
            _ctable_peer['TX_FREQ'] = _peer_conf['TX_FREQ'].substr(0,3) + '.' + _peer_conf['TX_FREQ'].substr(3, 7) + ' MHz'
            _ctable_peer['RX_FREQ'] = _peer_conf['RX_FREQ'].substr(0,3) + '.' + _peer_conf['RX_FREQ'].substr(3,7) + ' MHz'
        }
      }
    }
  
    // timeslots are kinda complicated too. 0 = none, 1 or 2 mean that one slot, 3 is both, and anything else it considered DMO
    // Slots (0, 1=1, 2=2, 1&2=3 Duplex, 4=Simplex) see https://wiki.brandmeister.network/index.php/Homebrew/example/php2
  
    switch(_peer_conf['SLOTS']) {
      case '0': _ctable_peer['SLOTS'] = 'NONE'; break;
      case '1': 
      case '2': _ctable_peer['SLOTS'] = _peer_conf['SLOTS']; break;
      case '3': _ctable_peer['SLOTS'] = 'Duplex'; break;
      default:  _ctable_peer['SLOTS'] = 'Simplex'; break;
    }
  
    _ctable_peer['PACKAGE_ID']    = _peer_conf['PACKAGE_ID'].trim()
    _ctable_peer['SOFTWARE_ID']   = _peer_conf['SOFTWARE_ID'].trim()
    _ctable_peer['LOCATION']      = _peer_conf['LOCATION'].trim()
    _ctable_peer['CALLSIGN']      = _peer_conf['CALLSIGN'].trim()
    _ctable_peer['COLORCODE']     = _peer_conf['COLORCODE']
    _ctable_peer['CONNECTION']    = _peer_conf['CONNECTION']
    _ctable_peer['LATITUDE']      = _peer_conf['LATITUDE'] || '0.0'
    _ctable_peer['LONGITUDE']     = _peer_conf['LONGITUDE'] || '0.0'
    _ctable_peer['HEIGHT']        = _peer_conf['HEIGHT'] || '0'

    // assign tuple
    let legalResult = this.isLegalMaster(peer)
    _ctable_peer['LEGAL'] = legalResult[0]
    _ctable_peer['CLASS'] = legalResult[1]

    _ctable_peer['CONNECTED']     = this.since(_peer_conf['CONNECTED'])
    _ctable_peer['CONNECTEDMS']   = _peer_conf['CONNECTED'] * 1000
    // _ctable_peer['ONLINE']     = str(_peer_conf['CONNECTED'])
    _ctable_peer['IP']            = _peer_conf['IP']
    _ctable_peer['PORT']          = _peer_conf['PORT']
    // _ctable_peer['LAST_PING']  = _peer_conf['LAST_PING']
  
    // SLOT 1&2 - for real-time montior: make the structure for later use
    for (let ts=1; ts < 3; ts++)
      _ctable_peer[ts]= { 'TS': '', 'TYPE':'', 'SUB':'', 'SRC':'', 'DEST':'', 'TXRX':'' }
  }

  /**
  * Cleaning entries in tables - Interval (this.intervalCleanTE, default is 3min) 
  */
  cleanTE() {
    let timeout = Date.now() / 1000     // timeout in seconds
    let ctabdata: any = null

    for(let system in __ctable__['MASTERS']) {
      for(let peer in __ctable__['MASTERS'][system]['PEERS']) {
        for(let timeS=1; timeS < 3; timeS++) {
          
          ctabdata = __ctable__['MASTERS'][system]['PEERS'][peer][timeS]

          if (ctabdata['TS']) {
            let ts = ctabdata['TIMEOUT']

            let td = Math.floor(Math.abs((ts - timeout)) / 60)

            if (td > this.intervalCleanTE) {
              ctabdata['TS']    = false
              ctabdata['TXRX']  = ''
              ctabdata['TYPE']  = ''
              ctabdata['SUB']   = ''
              ctabdata['SRC']   = ''
              ctabdata['DEST']  = ''
            }
          }
        }
      }
    }

    for(let system in __ctable__['PEERS']) {
      for(let timeS=1; timeS < 3; timeS++) {

        ctabdata = __ctable__['PEERS'][system][timeS]

        if (ctabdata['TS']) {
          let ts = ctabdata['TIMEOUT']

          let td = Math.floor(Math.abs((ts - timeout)) / 60)

          if (td > this.intervalCleanTE) {
            ctabdata['TS']    = false
            ctabdata['TXRX']  = ''
            ctabdata['TYPE']  = ''
            ctabdata['SUB']   = ''
            ctabdata['SRC']   = ''
            ctabdata['DEST']  = ''
          }
        }
      }
    }

    for(let system in __ctable__['OPENBRIDGES']) {
      for (let streamId in __ctable__['OPENBRIDGES'][system]['STREAMS']) {
        let ts = __ctable__['OPENBRIDGES'][system]['STREAMS'][streamId][3]

        let td = Math.floor(Math.abs((ts - timeout)) / 60)

        if (td > this.intervalCleanTE) {
          delete __ctable__['OPENBRIDGES'][system]['STREAMS'][streamId]
        }
      }
    }
  }
  
  /**
   * build_hblink_table
   * 
   * _config indexes in utf-8 binary string format ie "\u0000\u0000\u0000\u0000"
   * _stats_table uses indexes in utf8 string format ie "1234567"
   * 
   * @param _config 
   * @param _stats_table 
   */
  build_hblink_table(_config: any[], _stats_table:any): void  {
    if (config.__loginfo__)
      logger.info(`creating masters`)

    for(let _hbp in _config) {
      var _hbp_data = _config[_hbp]

      if (_hbp_data['ENABLED'] == true) {

        // Process Master Systems
        if (_hbp_data['MODE'] === 'MASTER') {
            // if not initialized, create empty
            if (_stats_table['MASTERS'] == null)
              _stats_table['MASTERS'] = {}

            // not empty, create empty entry if not present
            if (_stats_table['MASTERS'][_hbp] == null)
              _stats_table['MASTERS'][_hbp] = { 'REPEAT' : _hbp_data['REPEAT'] ? 'repeat':'isolate', 'PEERS' : {} }

            var peer = null

            // update with peers
            for(let _peer in _hbp_data['PEERS']) {
              // convert "\u0000\u0000\u0000\u0000" to "1234567" avoiding > 128 caveats
              peer = Buffer.from(_peer, 'latin1').readUInt32BE().toString()
              // add new peer
              this.add_hb_peer(_hbp_data['PEERS'][_peer], _stats_table['MASTERS'][_hbp]['PEERS'], peer)
            }
        } // Proccess Peer Systems
        else 
        if ((_hbp_data['MODE'] === 'PEER' || _hbp_data['MODE'] === 'XLXPEER') && config.__homebrew_inc__) {
          let legalResult = this.isLegalMaster(Buffer.from(_hbp_data['RADIO_ID'], 'latin1').readUInt32BE().toString())

          _stats_table['PEERS'][_hbp] = { 
            'MODE':         _hbp_data['MODE'], 
            'LOCATION':     _hbp_data['LOCATION'],
            'CALLSIGN':     _hbp_data['CALLSIGN'],
            'RADIO_ID':     Buffer.from(_hbp_data['RADIO_ID'], 'latin1').readUInt32BE().toString(),
            'MASTER_IP':    _hbp_data['MASTER_IP'],
            'MASTER_PORT':  _hbp_data['MASTER_PORT'],
            'LEGAL':        legalResult[0],
            'CLASS':        legalResult[1],
            'LATITUDE':     _hbp_data['LATITUDE'] || '0.0',
            'LONGITUDE':    _hbp_data['LONGITUDE'] || '0.0',
            'HEIGHT':       _hbp_data['HEIGHT'] || '0',
            'STATS':        {}
          }

          let element = _stats_table['PEERS'][_hbp]

          if (element['MODE'] === 'XLXPEER') {
              element['STATS']['CONNECTION'] = _hbp_data['XLXSTATS']['CONNECTION']

              if (_hbp_data['XLXSTATS']['CONNECTION'] === 'YES') {
                element['STATS']['CONNECTED'] = this.since(_hbp_data['XLXSTATS']['CONNECTED'])
                element['STATS']['CONNECTEDMS'] = _hbp_data['XLXSTATS']['CONNECTED'] * 1000
                element['STATS']['PINGS_SENT'] = _hbp_data['XLXSTATS']['PINGS_SENT']
                element['STATS']['PINGS_ACKD'] = _hbp_data['XLXSTATS']['PINGS_ACKD']
              } else {
                element['STATS']['CONNECTED'] = '--   --'
                element['STATS']['PINGS_SENT'] = 0
                element['STATS']['PINGS_ACKD'] = 0
              }
          } else {
              element['STATS'] = { 'CONNECTION' : _hbp_data['STATS']['CONNECTION'] }

              if (_hbp_data['STATS']['CONNECTION'] === 'YES') {
                element['STATS']['CONNECTED'] = this.since(_hbp_data['STATS']['CONNECTED'])
                element['STATS']['CONNECTEDMS'] = _hbp_data['STATS']['CONNECTED'] * 1000
                element['STATS']['PINGS_SENT'] = _hbp_data['STATS']['PINGS_SENT']
                element['STATS']['PINGS_ACKD'] = _hbp_data['STATS']['PINGS_ACKD']
              } else {
                element['STATS']['CONNECTED'] = '--   --'
                element['STATS']['PINGS_SENT'] = 0
                element['STATS']['PINGS_ACKD'] = 0
              }
          }

          switch(_hbp_data['SLOTS']) {
            case '0': element['SLOTS'] = 'NONE'; break;
            case '1': 
            case '2': element['SLOTS'] = _hbp_data['SLOTS']; break;
            case '3': element['SLOTS'] = '1&2'; break;
            default:  element['SLOTS'] = 'DMO'; break;
          }

          // SLOT 1&2 - for real-time montior: make the structure for later use
          for (let ts=1; ts < 3; ts++)
              element[ts]= { 'TS': '', 'TYPE': '', 'SUB': '', 'SRC': '', 'DEST': '' }
        } // Process OpenBridge systems
        else 
        if (_hbp_data['MODE'] === 'OPENBRIDGE') {
          _stats_table['OPENBRIDGES'][_hbp] = { 'NETWORK_ID': Buffer.from(_hbp_data['NETWORK_ID'], 'latin1').readUInt32BE().toString(),
                                                'TARGET_IP': _hbp_data['TARGET_IP'],
                                                'TARGET_PORT': _hbp_data['TARGET_PORT'],
                                                'STREAMS': {}
                                              }
        }
      }
    }
  }

  /**
   * update_hblink_table
   * 
   * _config indexes in utf-8 binary string format ie "\u0000\u0000\u0000\u0000"
   * _stats_table uses indexes in utf8 string format ie "1234567"
   * 
   * @param _config 
   * @param _stats_table 
   */
  update_hblink_table(_config: any[], _stats_table:any): void  {
    if (config.__loginfo__)
      logger.info(`updating masters`)

    for(let _hbp in _config) {
      let _hbp_data: any = _config[_hbp]
  
      // Process Master Systems
      if (_hbp_data['MODE'] === 'MASTER') {
        let peer = null

        for(let _peer in _hbp_data['PEERS']) {
          peer = Buffer.from(_peer, 'latin1').readUInt32BE().toString()

          if ((_stats_table['MASTERS'][_hbp]['PEERS'][peer] == null) && _hbp_data['PEERS'][_peer]['CONNECTION'] === 'YES') {
            // logger.info(`Adding peer to CTABLE that has registered: ${_peer}`)
            this.add_hb_peer(_hbp_data['PEERS'][_peer], _stats_table['MASTERS'][_hbp]['PEERS'], peer)
          }
        }
      } 
    }
  
    /**
     * Is there a system in monitor that's been removed from HBlink's config? 
     */
    for(let _hbp in _stats_table['MASTERS']) {
      let _hbp_data: any = _config[_hbp]
  
      if (_hbp_data['MODE'] === 'MASTER') {
        let peer = null   // string format
        let remove_list: string[] = []

        for(let peer in _stats_table['MASTERS'][_hbp]['PEERS']) {
          // convert python pickle binary format to string
          let _peer = this.ReverseEndian(peer) 

          if (_hbp_data['PEERS'][_peer] == null) {
            if (config.__loginfo__)
              logger.info(`peer id=${peer} marked for deletion`)
            remove_list.push(peer)
          }
        }

        for(let i=0; i<remove_list.length; i++) {
          if (config.__loginfo__)
            logger.info(`deleting peer id=${remove_list[i]}`)
          delete _stats_table['MASTERS'][_hbp]['PEERS'][remove_list[i]]
        }
      }
    }

    // Update connection time
    for(let _hbp in _stats_table['MASTERS']) {
        for(let peer in _stats_table['MASTERS'][_hbp]['PEERS']) {
            let _peer = this.ReverseEndian(peer)
            if (_config[_hbp]['PEERS'][_peer] != null) {
              _stats_table['MASTERS'][_hbp]['PEERS'][peer]['CONNECTED'] = this.since(_config[_hbp]['PEERS'][_peer]['CONNECTED'])
              _stats_table['MASTERS'][_hbp]['PEERS'][peer]['CONNECTEDMS'] = _config[_hbp]['PEERS'][_peer]['CONNECTED'] * 1000
            }
        }
    }

    for(let _hbp in _stats_table['PEERS']) {
      
      let stabdata = _stats_table['PEERS'][_hbp]['STATS']

      if (_stats_table['PEERS'][_hbp]['MODE'] === 'XLXPEER') {
          if (_config[_hbp]['XLXSTATS']['CONNECTION'] === "YES") {
              stabdata['CONNECTED']   = this.since(_config[_hbp]['XLXSTATS']['CONNECTED'])
              stabdata['CONNECTEDMS'] = _config[_hbp]['XLXSTATS']['CONNECTED'] * 1000
              // stabdata['ONLINE']   = str(_config[_hbp]['XLXSTATS']['ONLINE'])
              stabdata['CONNECTION']  = _config[_hbp]['XLXSTATS']['CONNECTION']
              stabdata['PINGS_SENT']  = _config[_hbp]['XLXSTATS']['PINGS_SENT']
              stabdata['PINGS_ACKD']  = _config[_hbp]['XLXSTATS']['PINGS_ACKD']
          }
          else {
            stabdata['CONNECTED']     = "--   --"
            // stabdata['ONLINE']     = "0"
            stabdata['CONNECTION']    = _config[_hbp]['XLXSTATS']['CONNECTION']
            stabdata['PINGS_SENT']    = 0
            stabdata['PINGS_ACKD']    = 0
          }
      }
      else {
          if (_config[_hbp]['STATS']['CONNECTION'] === "YES") {
              stabdata['CONNECTED']   = this.since(_config[_hbp]['STATS']['CONNECTED'])
              stabdata['CONNECTEDMS'] = _config[_hbp]['STATS']['CONNECTED'] * 1000
              // stabdata['ONLINE']   = str(_config[_hbp]['STATS']['ONLINE'])
              stabdata['CONNECTION']  = _config[_hbp]['STATS']['CONNECTION']
              stabdata['PINGS_SENT']  = _config[_hbp]['STATS']['PINGS_SENT']
              stabdata['PINGS_ACKD']  = _config[_hbp]['STATS']['PINGS_ACKD']
          }
          else {
            stabdata['CONNECTED']     = "--   --"
            // stabdata['ONLINE']     = "0"
            stabdata['CONNECTION']    = _config[_hbp]['STATS']['CONNECTION']
            stabdata['PINGS_SENT']    = 0
            stabdata['PINGS_ACKD']    = 0
          }
      }
    }

    this.cleanTE()
    this.build_stats()
  }

  /**
   * build_bridge_table
   */
  build_bridge_table(_bridges: any) {
    let _stats_table: any = {}
    let _now = Date.now() / 1000
		let tgbridges: any = null
    let hideSystems = new Set(config.__bridges_params__.hide)
    let wf = false

    // fs.writeFileSync(`${config.__log_path__}bridges.json`, JSON.stringify(_bridges, null, 2), { encoding:'utf-8', flag:'w' })

    for(let bridge in _bridges) {
      _stats_table[bridge] = {}
      tgbridges = _bridges[bridge]

      for(let currentTgName in tgbridges) {
        let system: string = tgbridges[currentTgName]

        // skip system to hide
        if (hideSystems.has(system["SYSTEM"]))
          continue

        if (system['ACTIVE'] == true || config.__bridges_params__.showDisconnected) {
          let to_action: string = ''
          let exptime: string = ''

          if (system['TO_TYPE'] === 'ON' || system['TO_TYPE'] === 'OFF') {
            exptime = (system['TIMER'] > _now) ? (system['TIMER'] - _now).toString() : 'Expired'
            to_action = (system['TO_TYPE'] === 'ON') ? 'Disconnect' : 'Connect'
          } 
          else 
          {
            exptime = 'n/a'
            to_action = 'None'
          }

          let active: string = (system['ACTIVE'] == true) ? 'Connected' : 'Disconnected'

          let trigOn: string = ''
          let trigOff: string = ''

          for(let j=0; j<system['ON'].length; j++) {
            if (j > 0)
              trigOn += ',' 

            trigOn += Buffer.from(system['ON'][j], 'latin1').readUIntBE(0, system['ON'][j].length)
          }

          for(let j=0; j<system['OFF'].length; j++) {
            if (j > 0)
              trigOff += ','

            trigOff += Buffer.from(system['OFF'][j], 'latin1').readUIntBE(0, system['OFF'][j].length)
          }

          let tgid = Buffer.from(system['TGID'], 'latin1').readIntBE(0, system['TGID'].length)

          if (config.__bridges_params__.alias[tgid])
            tgid = parseInt(config.__bridges_params__.alias[tgid])

          if (_stats_table[bridge][system['SYSTEM']])
            _stats_table[bridge][system['SYSTEM']].push({ 'TGID': tgid, 'TS': system['TS'], 'EXP_TIME': exptime, 'TO_ACTION': to_action, 'ACTIVE': active, 'TRIG_ON': trigOn, 'TRIG_OFF': trigOff })
          else
            _stats_table[bridge][system['SYSTEM']] = [{ 'TGID': tgid, 'TS': system['TS'], 'EXP_TIME': exptime, 'TO_ACTION': to_action, 'ACTIVE': active, 'TRIG_ON': trigOn, 'TRIG_OFF': trigOff }]
        }   
      }
    }
  
    return _stats_table
  }

  /**
   * Hotspots stats
   */
	sortMastersPeersByOnlineTime(peers: any) {
		var peersArray = [];

		// convert to array
		for (var key in peers) {
			peersArray.push([key, peers[key]]);
		}

		// convert online time to seconds
		let len = peersArray.length;
		for (let i = 0; i < len; i++) {
      let chr = ""
			let t = peersArray[i]["1"]["CONNECTED"].split(" ");

			switch (t.length) {
				case 3:
					peersArray[i]["1"]["ONLINE"] = "" + (parseInt(t[0]) * 86400 + parseInt(t[1]) * 3600 + parseInt(t[2]));
					break;

				case 2:
					chr = t[0].slice(-1);
					if (chr == 'd')
						peersArray[i]["1"]["ONLINE"] = "" + (parseInt(t[0]) * 86400 + parseInt(t[1]) * 3600);
					else
					if (chr == 'h')
						peersArray[i]["1"]["ONLINE"] = "" + (parseInt(t[0]) * 3600 + parseInt(t[1]) * 60);
					else
					if (chr == 'm')
						peersArray[i]["1"]["ONLINE"] = "" + (parseInt(t[0]) * 60 + parseInt(t[1]));
					break;

				case 1:
					peersArray[i]["1"]["ONLINE"] = "" + parseInt(t[0]);
					break;

				default:
					peersArray[i]["1"]["ONLINE"] = "0";
					break;
			}
		}

		// sort peers array
		peersArray.sort((a, b) => {
			let y = parseInt(a[1]["ONLINE"]);
			let x = parseInt(b[1]["ONLINE"]);

			return x < y ? -1 : x > y ? 1 : 0;
		});

		return peersArray;
	}
/*
  {
    "analytics": {
      masters: {
        "onlinebyhour": [0, 0, 0, 0, 0 ... ],
        "hotspots": [
          {
            "VRK-RPI": {
              "name": "XXX-RPI",
              "repeat": "repeat",
              "callsign": "F4xxx",
              "location": "Pte St Cloud,Paris",
              "netid": "208xxxxxx",
              "type": "Radio",
              "ip": "x>x.xx.xxx.xxx",
              "slot": "Duplex",
              "version": "20210617_PS4",
              "Hardware": "MMDVM_MMDVM_HS_Dual_Hat",
              "legal": true,
              "cnxTime": 1688907727501,
              "parsedTime": {
                "days": 355,
                "hours": 18
              },
              "lastseen": 1719646648700,
              "firstseen": 1719646648700
            }
          }
        },
      }
    }  
*/

  buildAnalytics(): any {
    let analytics = null

    if (fs.existsSync(`${config.__log_path__}${config.__analytics__}`)) {
      analytics = JSON.parse(fs.readFileSync(`${config.__log_path__}${config.__analytics__}`, 'utf-8'))

      if (!analytics["analytics"])
        analytics["analytics"] = { "masters": { "onlinebyhour": new Array(TIME_INTERVALS).fill(0), "hotspots": [] } }
      
      if (!analytics["analytics"]["masters"])
        analytics["analytics"]["masters"] = { "onlinebyhour": new Array(TIME_INTERVALS).fill(0), "hotspots": [] }

      if (!analytics["analytics"]["masters"]["hotspots"])
        analytics["analytics"]["masters"]["hotspots"] = []

      if (!analytics["analytics"]["masters"]["onlinebyhour"])
        analytics["analytics"]["masters"]["onlinebyhour"] = new Array(TIME_INTERVALS).fill(0)

      // to ensure compatibility with previous version, will be removed someday
      if (analytics["analytics"]["masters"]["onlinebyhour"].length < TIME_INTERVALS) 
        analytics["analytics"]["masters"]["onlinebyhour"].push(0)
    }
    else
      analytics = { "analytics": { "masters": { "onlinebyhour": new Array(TIME_INTERVALS).fill(0), "hotspots": [] } } }

    let m = analytics["analytics"]["masters"]["hotspots"]

    let masters = __ctable__["MASTERS"]

    let onlineCount = 0

    if (masters != null) {
      let date = new Date()
      let lastSeen = Date.now()

      for (let entry in masters) {

        let length = Object.keys(masters[entry]["PEERS"]).length
        if (!length)
            continue

        let peers = this.sortMastersPeersByOnlineTime(masters[entry]["PEERS"])
        let peersLength = peers.length

        try {
          if (peersLength != 0) {
            let blob = null
    
            for (let i = 0; i < peersLength; i++) {
              let netID = peers[i][0];
              let record = peers[i][1];

              let hardwareType = (record["RX_FREQ"] == "N/A" && record["TX_FREQ"] == "N/A") ? "IP Network" : "Radio";
  
              if (record["SLOTS"].startsWith("Slot"))
                record["SLOTS"] = 'VOIP'

              let cnxTime = record["CONNECTED"]
              let parsedTime = utils.parseElapsedTime(cnxTime)

              if (parsedTime.days && parsedTime.days > 0 || parsedTime.hours &&  parsedTime.hours > 0 || parsedTime.minutes && parsedTime.minutes > 4)
                onlineCount++

              blob = {
                "name":       entry,
                "repeat":     masters[entry]["REPEAT"],
                "callsign":   (record["CALLSIGN"] && record["CALLSIGN"].length > 0) ? record["CALLSIGN"]: 'n/a',
                "location":   (record["LOCATION"] && record["LOCATION"].length > 0) ? record["LOCATION"]: 'n/a',
                "netid":      netID,
                "type":       hardwareType,
                "ip":         record["IP"],
                "slot":       record["SLOTS"],
                "version":    record["SOFTWARE_ID"],
                "Hardware":   record["PACKAGE_ID"],
                "legal":      record["LEGAL"],
                "cnxTime":    Math.floor(record["CONNECTEDMS"]),
                "parsedTime": parsedTime,
                "lastseen":   lastSeen
              }

              let found = false
              for(let k=0; k<m.length; k++) {
                if (found = (Object.keys(m[k])[0] == entry)) {
                  break
                }
              }

              if (!found) {
                blob["firstseen"] = lastSeen
                m.push( { [entry]: blob } )
              }
            }
          }
        }
        catch (error) {
        }
      }

      // don't start at onlinebyhour 0
      if (!analytics["analytics"]["masters"]["onlinebyhour"][date.getHours()] || config.__hotspotMonitoring__) {
        analytics["analytics"]["masters"]["onlinebyhour"][date.getHours()] = onlineCount
        
        // reset the next hours
        if (config.__hotspotMonitoring__) {
          for(let h=date.getHours()+1; h<TIME_INTERVALS; h++)
            analytics["analytics"]["masters"]["onlinebyhour"][h] = 0
        }
      }
      else
        analytics["analytics"]["masters"]["onlinebyhour"][date.getHours()] = (analytics["analytics"]["masters"]["onlinebyhour"][date.getHours()] + onlineCount) / 2
        
      fs.writeFileSync(`${config.__log_path__}${config.__analytics__}`, JSON.stringify(analytics, null, 2), { encoding:'utf-8', flag:'w' })
    }

    return __analytics__ = analytics
  }

  /**
   * build_stats
   */
  build_stats() {
    this.now = Date.now()   // note here the time is in milliseconds

    if (this.now > this.build_time + 500 && this.dashboardServer != null) {

      this.buildAnalytics()

      this.dashboardServer.clients.forEach((ws: any) => {        
        if (ws.fromPage) {
          if (ws.page !== 'logbook') {
            if (ws.page === 'dashboard' || ws.page === 'aprs')
              ws.send(JSON.stringify({ 'CTABLE' : __ctable__, 'ANALYTICS': __analytics__, 'EMPTY_MASTERS' : config.__empty_masters__, 'BIGEARS': this.dashboardServer.clients.size.toString(), 'LISTENERS': __listeners__, 'DIAGNOSTICS': this.build_Diagnostic_table() }))
            else
              ws.send(JSON.stringify({ 'CTABLE' : __ctable__, 'BTABLE': { 'BRIDGES': __btable__['BRIDGES'] }, 'BIGEARS': this.dashboardServer.clients.size.toString(), 'LISTENERS': __listeners__, 'DIAGNOSTICS': this.build_Diagnostic_table()}))
          } else {
            ws.send(JSON.stringify({ 'BIGEARS': this.dashboardServer.clients.size.toString(), 'LISTENERS': __listeners__, 'DIAGNOSTICS': this.build_Diagnostic_table() }))
          }
        }
      })
          
      this.mapIpAdresses()

      this.build_time = this.now
    }
  }

  /**
   * rts_update
   * 
   * @param p 
   */

  rts_update(p: any): void  {
    let callType: string        = p[0]
    let action: string          = p[1]
    let trx: string             = p[2]
    let system: string          = p[3]
    let streamId: string        = p[4]
    let sourcePeer: number      = parseInt(p[5])
    let sourceSub: string       = p[6]
    let timeSlot: number        = parseInt(p[7])
    let destination: string     = p[8]
    let timeout                 = Date.now() / 1000       // timeout in seconds
    
    let ctabdata: any           = null    

    if (__ctable__['MASTERS'] && __ctable__['MASTERS'][system] != null && __ctable__['MASTERS'][system]['PEERS'] != null) {
      
      for(let peer in __ctable__['MASTERS'][system]['PEERS']) {
        
        ctabdata = __ctable__['MASTERS'][system]['PEERS'][peer][timeSlot]

        if (action === 'START') {
          ctabdata['TIMEOUT']   = timeout
          ctabdata['TS']        = true
          
          if (sourcePeer == null || p[5] === '' || peer == null || peer === '')
              ctabdata['TXRX']  = ''
          else
              ctabdata['TXRX']  = (sourcePeer == parseInt(peer)) ? 'TX' : 'RX'

          ctabdata['TYPE']      = callType
          ctabdata['SRC']       = peer
          ctabdata['SUB']       = sourceSub.length < 7 ? `${utils.peer_short(sourceSub, __peers_ids__)} (${sourceSub})` : `${utils.alias_short(sourceSub, __subscriber_ids__)} (${sourceSub})`
          ctabdata['DEST']      = `${utils.alias_tgid(destination, __talkgroup_ids__)} (${destination})`
          ctabdata['TGID']      = destination

          let networkData = utils.getNetWorkPicture(ctabdata['TGID'], ctabdata['DEST'])
          ctabdata['TGIMG'] = networkData['TGIMG']
          ctabdata['DEST'] = networkData['ALIAS']
        }

        if (action === 'END') {
          ctabdata['TS']        = false
          ctabdata['TXRX']      = ''
          ctabdata['TYPE']      = ''
          ctabdata['SUB']       = ''
          ctabdata['SRC']       = ''
          ctabdata['DEST']      = ''
          ctabdata['TGID']      = ''
          ctabdata['TGIMG']     = ''

          // deal with Extracommands etc..
          this.extra.rts_update(parseInt(destination))
        }
      }
    }

    if (__ctable__['OPENBRIDGES'][system]) {
      if (action === 'START')
        __ctable__['OPENBRIDGES'][system]['STREAMS'][streamId] = [trx, sourceSub.length < 7 ? utils.peer_call(sourceSub, __peers_ids__) : utils.alias_call(sourceSub, __subscriber_ids__), `TG${destination}`, timeout]
      else
      if (action === 'END' && __ctable__['OPENBRIDGES'][system]['STREAMS'][streamId])
        delete __ctable__['OPENBRIDGES'][system]['STREAMS'][streamId]
    }

    if (__ctable__['PEERS'][system]) {

      ctabdata = __ctable__['PEERS'][system][timeSlot]

      if (action === 'START') {
        ctabdata['TIMEOUT']     = timeout
        ctabdata['TS']          = true
        ctabdata['SUB']         = `${ sourceSub.length < 7 ? utils.alias_short(sourceSub, __peers_ids__) : utils.alias_short(sourceSub, __subscriber_ids__)} (${sourceSub})`
        ctabdata['SRC']         = sourcePeer
        ctabdata['DEST']        = `${utils.alias_tgid(destination, __talkgroup_ids__)} (${destination})`
        ctabdata['TGID']        = destination

        let networkData = utils.getNetWorkPicture(ctabdata['TGID'], ctabdata['DEST'])
        ctabdata['TGIMG'] = networkData['TGIMG']
        ctabdata['DEST'] = networkData['ALIAS']

        ctabdata['TXRX']        = (sourcePeer == null || sourceSub == null || destination == null) ? '': trx
      }

      if (action === 'END') {
        ctabdata['TS']          = false
        ctabdata['TYPE']        = ''
        ctabdata['SUB']         = ''
        ctabdata['SRC']         = ''
        ctabdata['DEST']        = ''
        ctabdata['TXRX']        = ''
        ctabdata['TGID']        = ''
        ctabdata['TGIMG']       = ''
      }
    }

    this.build_stats()
  }

  // https://stackoverflow.com/questions/25791436/reconnect-net-socket-nodejs

  constructor(monitor: Monitor, address: string, port: number) {
    this.opbNotAllowed = new Set()
    this.monitor = monitor
    this.dashboardServer = this.monitor.dashboardServer
    
    this.diagnostics = new diags.Diagnostics()
    this.diagnostics.runCheck()

    __ctable__ = { 'PEERS': {}, 'OPENBRIDGES': {} }

    if (config.__extra_settings__?.masters && config.__extra_settings__.masters?.padding) {
      this.dayPadding = (config.__extra_settings__.masters.padding?.days) ? config.__extra_settings__.masters.padding?.days : 3
      this.hourPadding = (config.__extra_settings__.masters.padding?.hours) ? config.__extra_settings__.masters.padding?.hours : 2
      this.minutePadding = (config.__extra_settings__.masters.padding?.minutes) ? config.__extra_settings__.masters.padding?.minutes : 2
      this.secondsPadding = (config.__extra_settings__.masters.padding?.seconds) ? config.__extra_settings__.masters.padding?.seconds : 2
    }

    try {
      setInterval(() => {
        this.build_stats()
      }, config.__frequency__ * 1000)

      logger.info(`reporter build stats activated at a ${config.__frequency__}s interval\n`)
    }
    catch(e) {
      logger.info(`Error in build stats: ${e.toString()}`)
    }

    this.pickleparser = new PickleParser()
    this.client = new netsocket.Socket()
    this.client.setKeepAlive(true, 5000)

    this.client.on('error', () => {
      if (!config.testMode) {
        logger.info(`server socket error`)
        launchIntervalConnect()
      }
    })

    this.client.on('close', () => {
      if (!config.testMode) {
        logger.info(`server socket closed`)
        launchIntervalConnect()
      }
    })

    this.client.on('end', () => {
      if (!config.testMode) {
        logger.info(`server socket ended`)
        launchIntervalConnect()
      }
    })

    let connect = () => {
      logger.info('connecting to HBLink/FreeDMR server')

      this.client.removeAllListeners('data')

      if (this.netstring !== null) {
        this.netstring.kill()
        this.netstring = null
      }

      this.client.connect({ 'port': port, 'host': address }, () => {
        logger.info(`monitoring server ${address}:${port}`)
      })
    }

    let clearIntervalConnect = () => {
      if (null == this.reconnectTicker) 
        return

      clearInterval(this.reconnectTicker)
      this.reconnectTicker = null
    }

    let launchIntervalConnect = () => {
      if (null != this.reconnectTicker) 
        return

      this.reconnectTicker = setInterval(() => {
        if (this.reconnectTries-- > 0) {
          logger.info(`reconnection attempt ${MAXTRIES - this.reconnectTries}/${MAXTRIES}`)
          connect()
        } 
        else {
          clearInterval(this.reconnectTicker)
          this.reconnectTicker = null

          logger.info(`reconnection ${globals.__FAILED__}, check server`)
        }
      }, 5000)
    }

    let treatConnection = () => {
      clearIntervalConnect()
  
      /**
       * callback for netstring protocol
       */
      this.client.gotBox = (data: Buffer) => {
        if (config.__loginfo__)
          logger.info('gotBox')
        
        var opcode = data[0]
        var message = data.subarray(1)
        var now = this.strftimeNow();
  
        switch(opcode) {
          case Opcodes.CONFIG_SND:
            try {
              let unpickeled:any = this.pickleparser.load(message)
  
              if (__ctable__['MASTERS'] == null) {
                if (config.__loginfo__)
                  logger.info(`build_hblink_table`)
                this.build_hblink_table(unpickeled, __ctable__)
              }
              else {
                if (config.__loginfo__)
                  logger.info(`update_hblink_table`)
                this.update_hblink_table(unpickeled, __ctable__)
              }
            }
            catch(e) {
              logger.info(`__ctable__ build/update error`)
            }
            break
  
          case Opcodes.BRIDGE_SND:
            __bridges__ = this.pickleparser.load(message)   
            __bridges_rx__ = this.strftime(new Date())
            if (config.__bridges_inc__)
              __btable__['BRIDGES'] = this.build_bridge_table(__bridges__)
            break
  
          case Opcodes.LINK_EVENT:
            logger.info(`LINK_EVENT Received: ${message}`)
            break
  
          case Opcodes.BRDG_EVENT:
            if (config.__loginfo__)
              logger.info(`BRIDGE EVENT: ${message}`)
  
            var p = message.toString().split(',')

            const REPORT_TGID: string     = p[8]

            // stop here if not allowed
            if (!this.monitor.IsTgidAllowed(REPORT_TGID) && !config.tgid_allow_obp_and_masters)
              break

            const REPORT_TYPE: string     = p[0]
            const REPORT_RXTX: string     = p[2]
            const REPORT_SYS: string      = p[3]
            const REPORT_SRC_ID: string   = p[5]
  
            this.rts_update(p)
  
            // check for filtered BACKEND OBP
            if (config.__opb_backend__[REPORT_SYS] != null) {
              let found = false
  
              for(let k=0; k < config.__opb_backend__[REPORT_SYS].length; k++) {
                if (config.__opb_backend__[REPORT_SYS][k] == REPORT_SRC_ID) {
                  found = true
                  break;
                }
              }
  
              if (!found) {
                if (!this.opbNotAllowed.has(REPORT_SYS)) {
                  this.opbNotAllowed.add(REPORT_SYS)
                  logger.info(`BACKEND OBP '${REPORT_SYS}' WITH ID='${REPORT_SRC_ID}' NOT ALLOWED`)
                }
                return
              }
            }
  
            if (monitor.IsTgidAllowed(REPORT_TGID) && REPORT_TYPE === 'GROUP VOICE' && REPORT_RXTX != 'TX' && !this.opbfilter.has(REPORT_SRC_ID)) {
              var REPORT_DATE     = now.substring(0, 10)
              var REPORT_TIME     = now.substring(11, 19)
              var REPORT_PACKET   = p[1]
              var REPORT_DMRID    = p[6]
              var REPORT_TS       = p[7]
  
              var REPORT_ALIAS    = utils.alias_tgid(REPORT_TGID, __talkgroup_ids__)
              var callfname       = REPORT_DMRID.length < 7 ? utils.peer_only(REPORT_DMRID,  __peers_ids__): utils.alias_only(REPORT_DMRID,  __subscriber_ids__)
              var REPORT_CALLSIGN = callfname[0].trim()
              var REPORT_FNAME    = callfname[1].trim()
              var REPORT_BOTH     = utils.alias_short(REPORT_DMRID,  __subscriber_ids__)
              var REPORT_TGIMG    = ''
  
              var jsonStr = {}

              let networkData = utils.getNetWorkPicture(REPORT_TGID, REPORT_ALIAS)
              REPORT_TGIMG = networkData['TGIMG']
              REPORT_ALIAS = networkData['ALIAS']
    
              if (REPORT_PACKET === 'END') {
                let REPORT_DELAY = parseInt(p[9])
                // append new entry
                jsonStr = { 'DATE': REPORT_DATE, 'TIME': REPORT_TIME, 'TYPE': REPORT_TYPE.substring(6), 'PACKET': REPORT_PACKET, 'SYS': REPORT_SYS, 'SRC_ID': REPORT_SRC_ID, 'TS': REPORT_TS, 'TGID': REPORT_TGID, 'ALIAS': REPORT_ALIAS, 'TGIMG': REPORT_TGIMG, 'DMRID': REPORT_DMRID, 'CALLSIGN': REPORT_CALLSIGN, 'NAME': REPORT_FNAME, 'DELAY': REPORT_DELAY }
  
                this.updateLastheard(jsonStr)
  
                // log only to file if system is NOT OpenBridge event (not logging open bridge system, name depends on your OB definitions) 
                // and transmit time is LONGER as N sec (make sense for very short transmits)
                if (config.__lastheard_inc__ && parseInt(p[9]) > 0) {
                  // 2023-07-21 11:16:27 CEST,61,GROUP VOICE,END,RIS-PEER+,2080xxxx,2080xxxx,TS1,TG20859,YSF-Linux.fr (FD),208xxxx,F4XXX, Pxxx F4XXX
                  let dt = new Date()
                  let diffTZ = dt.getTimezoneOffset() / -60
                  let buffer: string = `${this.strftime(new Date())} UTC${diffTZ < 0 ? diffTZ : '+' + diffTZ },${REPORT_DELAY},${REPORT_TYPE},${REPORT_PACKET},${REPORT_SYS},${REPORT_SRC_ID},${utils.alias_call(REPORT_SRC_ID, __subscriber_ids__)},TS${REPORT_TS},TG${REPORT_TGID},${REPORT_ALIAS},${REPORT_DMRID},${callfname}\n`
  
                  if (fs.existsSync(`${config.__log_path__}${config.__lastheard_log__}`))
                    fs.appendFileSync(`${config.__log_path__}${config.__lastheard_log__}`, buffer, 'utf-8')
                  else
                    fs.writeFileSync(`${config.__log_path__}${config.__lastheard_log__}`, buffer, 'utf-8')
                }
              }
              else 
              if (REPORT_PACKET === 'START') {
                jsonStr = { 'DATE': REPORT_DATE, 'TIME': REPORT_TIME, 'TYPE': REPORT_TYPE.substring(6), 'PACKET': REPORT_PACKET, 'SYS': REPORT_SYS, 'SRC_ID': REPORT_SRC_ID, 'TS': REPORT_TS, 'TGID': REPORT_TGID, 'ALIAS': REPORT_ALIAS, 'TGIMG': REPORT_TGIMG ,'DMRID': REPORT_DMRID, 'CALLSIGN': REPORT_CALLSIGN, 'NAME': REPORT_FNAME, 'DELAY': 0 }
                
                this.updateLastheard(jsonStr)
              }
              else
              if (REPORT_PACKET === 'END WITHOUT MATCHING START')
                jsonStr = { 'DATE': REPORT_DATE, 'TIME': REPORT_TIME, 'TYPE':REPORT_TYPE.substring(6), 'PACKET': REPORT_PACKET, 'SYS': REPORT_SYS, 'SRC_ID': REPORT_SRC_ID, 'TS': REPORT_TS, 'TGID': REPORT_TGID, 'ALIAS': REPORT_ALIAS, 'TGIMG': REPORT_TGIMG, 'DMRID': REPORT_DMRID, 'CALLSIGN': REPORT_CALLSIGN, 'NAME': REPORT_FNAME, 'DELAY': 0 }
              else
                jsonStr = { 'DATE': now.substring(0, 10), 'TIME': now.substring(10), 'PACKET': 'UNKNOWN GROUP VOICE LOG MESSAGE' }              
  
              this.broadcast({ 'TRAFFIC' : jsonStr, 'BIGEARS': this.dashboardServer.clients.size.toString() })
            }
  
            break
  
          default:
            this.netstring.reSync()
  
            if (opcode) {
              // weird notification string packet at the end, skip it
              if (new Set([98]).has(opcode))
                break
  
              logger.info(`got unknown opcode: ${opcode.toString()}`)
  /*
              let filename = `${__log_path__}trace/hblink_opcode${opcode}.pick`
              fs.writeFileSync(filename, data, { encoding: 'utf8' })
              logger.info(`${filename} written`)      
  */
            }
            else
              logger.info(`got null opcode`)
        }
      }

      /**
       * reset the parser
       */
      this.pickleparser.reSync()

      /**
       * instanciation of netstring object
       */
      this.netstring = new NetStringReceiver(this.client.gotBox)

      /**
       * socket data listener
       */
      this.client.on('data', (data: string) => {
        this.netstring.dataReceived(data)
      })
    }

    this.client.on('connect', () => {
      treatConnection()
    })

    connect()

    if (config.testMode) {
      treatConnection()
      this.simulateCtable()
    }
  }

  simulateCtable() {
    try {
      setInterval(() => {
        this.packetCount= 0

        while(true) {
          let filename = `${config.__log_path__}trace/hblink${this.packetCount++}.pick`
    
          if (!fs.existsSync(filename))
            break
    
          
            this.netstring.dataReceived(fs.readFileSync(filename))
        }
      }, 10000)
    }
    catch(e) {
    }
  }

  /**
   * cleanup
   */
  cleanup() {    
/*    
    __ctable__['MASTERS']= {}
    __ctable__['PEERS'] = {}
    __ctable__['OPENBRIDGES'] = {}
    __btable__['BRIDGES'] = {}
    logger.info('initializing tables')
*/    
  }

  /**
   * 
   * Update log file
   * 
   * @param jsonStr
   */
  updateLastheard(jsonStr: any) {
    // update log file
    this.monitor.__traffic__.unshift(jsonStr)
    
    // adjust max length
    this.monitor.__traffic__.length = Math.min(this.monitor.__traffic__.length, config.__traffic_size__)
    
    fs.writeFileSync(config.__log_path__ + 'lastheard.json', JSON.stringify({ 'TRAFFIC': this.monitor.__traffic__ }) , 'utf-8')
  }

  /**
 * broadcast to socket clients
 */
  broadcast(data: any) {
    this.dashboardServer.clients.forEach((ws: any) => {
      // best case, request from regular page
      if (ws.fromPage) {
        ws.send(JSON.stringify(data))
      } else {
        // request from web service
        let t = data['TRAFFIC']
        let valid = false
        let requestip = ws._socket.remoteAddress.replace(/^.*:/, '')

        // cleanup before sending
        if (t['BIGEARS'])
          delete t['BIGEARS']

        if (config.__allowed__socket_clients__ != null) {
          for(let i=0; i<config.__allowed__socket_clients__.length; i++) {
            let item = config.__allowed__socket_clients__[i]
            if (item.ipaddress == requestip) {
              if (item.tglist.length == 0) {
                ws.send(JSON.stringify(data))
                break
              }

              for(let j=0; j<item.tglist.length; j++) {
                let pattern = item.tglist[j]
                let index = -1
                if (pattern == t.TGID) {
                  valid = true
                  break
                }

                if ((index = pattern.indexOf('*')) != -1 && t.TGID.startsWith(pattern.substring(0, index))) {
                  valid = true
                  break
                }

                if ((index = pattern.indexOf('..')) != -1) {
                  if (parseInt(pattern.substring(0, index)) <= parseInt(t.TGID) && parseInt(t.TGID) <= parseInt(pattern.substring(index+2))) {
                    valid = true
                    break
                  }
                }
              }

              if (valid) {
                ws.send(JSON.stringify(data))
              }
            }
          }
        }
      }
    })
  }

  strftime(currentDate: Date): string {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const hours = String(currentDate.getHours()).padStart(2, '0');
    const minutes = String(currentDate.getMinutes()).padStart(2, '0');
    const seconds = String(Math.trunc(currentDate.getSeconds())).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  strftimeNow(): string {
    return this.strftime(new Date())
  }
}
