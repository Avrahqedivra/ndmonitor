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
 *  Copyright(c) 2023-26 F4JDN - Jean-Michel Cohen
 *
 */

import fs from "fs"
import netsocket from "net"

import {
  logger,
  __subscriber_ids__,
  __talkgroup_ids__,
  __peers_ids__,
  utils,
} from "./monitor.js"
import { NetStringReceiver } from "./lib/netstrings.js"
import { PickleParser } from "./lib/pickleparser.js"
import { Monitor } from "./monitor.js"

import * as globals from "./globals.js"
import * as config from "./config.js"
import * as diags from "./diagnostics.js"
import { Extra } from "./extracommand.js"

import { SocketProxy } from "./socketproxy.js"

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Opcodes for the reporting protocol to HBLink */
enum Opcodes {
  CONFIG_REQ = 0,
  CONFIG_SND,
  BRIDGE_REQ,
  BRIDGE_SND,
  CONFIG_UPD,
  BRIDGE_UPD,
  LINK_EVENT,
  BRDG_EVENT,
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

interface TimeslotData {
  TS: boolean | string
  TYPE: string
  SUB: string
  SRC: string | number
  DEST: string
  TXRX: string
  TIMEOUT?: number
  TGID?: string
  TGIMG?: string
  ALIAS?: string
}

interface PeerEntry {
  TX_FREQ: string
  RX_FREQ: string
  SLOTS: string
  PACKAGE_ID: string
  SOFTWARE_ID: string
  LOCATION: string
  CALLSIGN: string
  COLORCODE: string
  CONNECTION: string
  LATITUDE: string
  LONGITUDE: string
  HEIGHT: string
  LEGAL: boolean
  CLASS: string
  CONNECTED: string
  CONNECTEDMS: number
  IP: string
  PORT: number | string
  ONLINE?: string
  [ts: number]: TimeslotData // timeslot 1 & 2
}

interface MasterEntry {
  REPEAT: string
  PEERS: Record<string, PeerEntry>
}

interface PeerStatsEntry {
  MODE: string
  LOCATION: string
  CALLSIGN: string
  RADIO_ID: string
  MASTER_IP: string
  MASTER_PORT: number | string
  LEGAL: boolean
  CLASS: string
  LATITUDE: string
  LONGITUDE: string
  HEIGHT: string
  SLOTS: string
  STATS: Record<string, string | number>
  [ts: number]: TimeslotData
}

interface OpenBridgeStream {
  /** [trx, callerAlias, tgLabel, timeoutSeconds] */
  [streamId: string]: [string, string, string, number]
}

interface OpenBridgeEntry {
  NETWORK_ID: string
  TARGET_IP: string
  TARGET_PORT: number | string
  STREAMS: OpenBridgeStream
}

export interface CTable {
  MASTERS?: Record<string, MasterEntry>
  PEERS: Record<string, PeerStatsEntry>
  OPENBRIDGES: Record<string, OpenBridgeEntry>
}

interface BridgeTgEntry {
  TGID: number
  TS: string | number
  EXP_TIME: string
  TO_ACTION: string
  ACTIVE: string
  TRIG_ON: string
  TRIG_OFF: string
}

export interface BTable {
  BRIDGES: Record<string, Record<string, BridgeTgEntry[]>>
}

interface ListenerEntry {
  CALLSIGN: string
  IP: string
  PORT: number | string
  NETID: string
}

interface AnalyticsHotspotBlob {
  name: string
  repeat: string
  callsign: string
  location: string
  netid: string
  type: string
  ip: string
  slot: string
  version: string
  Hardware: string
  legal: boolean
  cnxTime: number
  parsedTime: Record<string, number> | null
  lastseen: number
  firstseen?: number
}

interface Analytics {
  analytics: {
    masters: {
      onlinebyhour: number[]
      hotspots: Array<Record<string, AnalyticsHotspotBlob>>
    }
  }
}

interface TrafficEntry {
  DATE: string
  TIME: string
  TYPE: string
  PACKET: string
  SYS: string
  SRC_ID: string
  TS: string
  TGID: string
  ALIAS: string
  TGIMG: string
  DMRID: string
  CALLSIGN: string
  NAME: string
  DELAY: number
}

interface LegalMasterResult {
  allowed: boolean
  cls: string
}

interface PaddingConfig {
  days?: number
  hours?: number
  minutes?: number
  seconds?: number
}

// ---------------------------------------------------------------------------
// Module-level exports (mirrors original `export let` declarations)
// ---------------------------------------------------------------------------

export let __analytics__: Analytics | null = null
export let __ctable__: CTable
export let __btable__: BTable = { BRIDGES: {} }
export let __bridges__: unknown
export let __listeners__: ListenerEntry[]
export let __bridges_rx__: string = ""

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIME_INTERVALS = 25 // 24 + 1
const MAXTRIES = 5

// ---------------------------------------------------------------------------
// Reporter class
// ---------------------------------------------------------------------------

interface EnhancedSocket extends netsocket.Socket {
  gotBox?: (data: Buffer) => void
}

// https://cs.lmu.edu/~ray/notes/jsnetexamples/
export class Reporter {
  private readonly legalMasters = new Set(config.__legal_masters__)

  private opbNotAllowed: Set<string> | null = null
  private monitor: Monitor | null = null
  private dashboardServer: unknown = null
  private diagnostics: diags.Diagnostics | null = null
  private extra: Extra = new Extra()
  private client: netsocket.Socket | null = null
  private netstring: NetStringReceiver | null = null
  private pickleparser: PickleParser | null = null

  private packetCount: number = 0
  private now: number = Date.now()
  private build_time: number = 0
  private status_time: number = 0

  private readonly opbfilter = new Set<string>(config.__opb_filter__)
  private readonly intervalCleanTE = 3
  private reconnectTicker: ReturnType<typeof setInterval> | null = null
  private reconnectTries: number = MAXTRIES

  // Padding widths for elapsed-time formatting
  private dayPadding: number = 3
  private hourPadding: number = 2
  private minutePadding: number = 2
  private secondsPadding: number = 2

  private socketProxy: SocketProxy | null = null

  // -------------------------------------------------------------------------
  // Elapsed-time helpers
  // -------------------------------------------------------------------------

  /** Returns a human-readable elapsed time string from a Unix timestamp (seconds). */
  since(_time: number): string {
    const elapsed = Date.now() / 1000 - _time

    const days: number = Math.floor(elapsed / 86400)
    const hours: number = Math.floor(elapsed / 3600) % 24
    const minutes: number = Math.floor(elapsed / 60) % 60
    const seconds: number = Math.trunc(elapsed % 60)

    if (days)
      return `${String(days).padStart(this.dayPadding, "0")}d ${String(hours).padStart(this.hourPadding, "0")}h`
    if (hours)
      return `${String(hours).padStart(this.hourPadding, "0")}h ${String(minutes).padStart(this.minutePadding, "0")}m`
    if (minutes)
      return `${String(minutes).padStart(this.minutePadding, "0")}m ${String(seconds).padStart(this.secondsPadding, "0")}s`

    return `${String(seconds).padStart(this.secondsPadding, "0")}s`
  }

  // -------------------------------------------------------------------------
  // Endian helpers
  // -------------------------------------------------------------------------

  /**
   * Converts a decimal-string peer ID (e.g. `"1234567"`) to a 4-byte big-endian
   * latin1 string as used by the Python pickle format.
   */
  ReverseEndian(peer: string): string {
    const buf = Buffer.alloc(4)
    buf.writeUInt32BE(parseInt(peer, 10), 0)
    return buf.toString("latin1")
  }

  /** Rebuilds the diagnostic table at most once every 10 seconds. */
  /**
   * Build diagnostic table
   * scanns a table of ip, services etc to check their state
   */
  build_Diagnostic_table() {
    this.now = Date.now()

    // update status every 10s
    if (this.now - this.status_time > 10000) {
      this.status_time = this.now

      if (this.diagnostics?.pending) return currentDiag

      currentDiag = [...diags.__diag_table__].sort((a: any, b: any) => {
        // note the minus before -cmp, for descending order
        return a.ORDER > b.ORDER ? 1 : a.ORDER < b.ORDER ? -1 : 0
      })

      this.diagnostics?.runCheck()
    }

    return currentDiag
  }

  // -------------------------------------------------------------------------
  // IP mapping
  // -------------------------------------------------------------------------

  /**
   * Creates a list of IP addresses connected to the dashboard and attempts to
   * identify them using the master peer data.
   */
  mapIpAdresses(): void {
    if (!config.__do_ipmap__) return

    try {
      const known_ip: Array<Record<string, ListenerEntry>> = []

      for (const system in __ctable__["MASTERS"]) {
        const ctabdata = __ctable__["MASTERS"]![system]["PEERS"]
        for (const peer in ctabdata) {
          const record = ctabdata[peer]
          if (record["CALLSIGN"] && record["IP"] && record["PORT"]) {
            known_ip.push({
              [record["IP"].trim()]: {
                CALLSIGN: record["CALLSIGN"].trim(),
                IP: record["IP"].trim(),
                PORT: record["PORT"],
                NETID: peer,
              },
            })
          }
        }
      }

      __listeners__ = []
      ;(this.dashboardServer as any).clients.forEach((client: any) => {
        // Strip IPv6-mapped IPv4 prefix (e.g. "::ffff:") and loopback
        const hostip: string =
          client._socket.remoteAddress === "::1"
            ? "127.0.0.1"
            : client._socket.remoteAddress.replace(/^.*:/, "")

        const match = known_ip.find((entry) => entry[hostip])
        if (match) __listeners__.push(match[hostip])
        else
          __listeners__.push({
            CALLSIGN: "n/a",
            IP: hostip,
            PORT: config.__monitor_webserver_port__,
            NETID: "n/a",
          })
      })
    } catch {
      __listeners__ = []
    }
  }

  // -------------------------------------------------------------------------
  // Legal-master checking
  // -------------------------------------------------------------------------

  /**
   * Returns whether `id` is a permitted master, plus its CSS class name.
   * Supports exact match, wildcard suffix (`*`), numeric range (`lo..hi`),
   * and negation prefix (`~`).
   */
  isLegalMaster(id: string): LegalMasterResult {
    if (config.__legal_masters__.length < 2) return { allowed: true, cls: "" }

    for (const entry of config.__legal_masters__) {
      let pattern: string = entry.id
      const negate: boolean = pattern.startsWith("~")
      if (negate) pattern = pattern.substring(1)

      // Exact match
      if (pattern === id) return { allowed: !negate, cls: entry.class }

      // Wildcard suffix
      const starIdx = pattern.indexOf("*")
      if (starIdx !== -1 && id.startsWith(pattern.substring(0, starIdx)))
        return { allowed: !negate, cls: entry.class }

      // Numeric range  lo..hi
      const rangeIdx = pattern.indexOf("..")
      if (rangeIdx !== -1) {
        const lo = parseInt(pattern.substring(0, rangeIdx), 10)
        const hi = parseInt(pattern.substring(rangeIdx + 2), 10)
        const n = parseInt(id, 10)
        if (lo <= n && n <= hi) return { allowed: !negate, cls: entry.class }
      }
    }

    return { allowed: false, cls: "msAlien" }
  }

  // -------------------------------------------------------------------------
  // Peer table helpers
  // -------------------------------------------------------------------------

  /**
   * Adds a new peer record to `_ctable_loc`, converting raw HBLink config
   * fields into display-ready strings.
   *
   * `_peer_conf` uses binary latin1 indexes; `_ctable_loc` uses decimal-string
   * indexes.
   */
  add_hb_peer(
    _peer_conf: Record<string, any>,
    _ctable_loc: Record<string, PeerEntry>,
    peer: string,
  ): void {
    const p: Partial<PeerEntry> = {}
    _ctable_loc[peer] = p as PeerEntry

    // Frequency — treat missing or "000.xxx" as not-an-RF-peer
    if (_peer_conf["TX_FREQ"] == null || _peer_conf["RX_FREQ"] == null) {
      p["TX_FREQ"] = "n/a"
      p["RX_FREQ"] = "n/a"
    } else {
      const tx: string = _peer_conf["TX_FREQ"].trim()
      const rx: string = _peer_conf["RX_FREQ"].trim()
      if (!isNaN(Number(tx)) && !isNaN(Number(rx))) {
        if (tx.startsWith("000") || rx.startsWith("000")) {
          p["TX_FREQ"] = "n/a"
          p["RX_FREQ"] = "n/a"
        } else {
          p["TX_FREQ"] = `${tx.substring(0, 3)}.${tx.substring(3, 7)} MHz`
          p["RX_FREQ"] = `${rx.substring(0, 3)}.${rx.substring(3, 7)} MHz`
        }
      } else {
        // Non-numeric values — preserve as-is
        p["TX_FREQ"] = tx
        p["RX_FREQ"] = rx
      }
    }

    // Slots
    // 0 = none, 1 = slot 1, 2 = slot 2, 3 = duplex (both), other = simplex/DMO
    switch (_peer_conf["SLOTS"]) {
      case "0":
        p["SLOTS"] = "NONE"
        break
      case "1":
      case "2":
        p["SLOTS"] = _peer_conf["SLOTS"]
        break
      case "3":
        p["SLOTS"] = "Duplex"
        break
      default:
        p["SLOTS"] = "Simplex"
        break
    }

    p["PACKAGE_ID"] = _peer_conf["PACKAGE_ID"].trim()
    p["SOFTWARE_ID"] = _peer_conf["SOFTWARE_ID"].trim()
    p["LOCATION"] = _peer_conf["LOCATION"].trim()
    p["CALLSIGN"] = _peer_conf["CALLSIGN"].trim()
    p["COLORCODE"] = _peer_conf["COLORCODE"]
    p["CONNECTION"] = _peer_conf["CONNECTION"]
    p["LATITUDE"] = _peer_conf["LATITUDE"] ?? "0.0"
    p["LONGITUDE"] = _peer_conf["LONGITUDE"] ?? "0.0"
    p["HEIGHT"] = _peer_conf["HEIGHT"] ?? "0"

    const { allowed, cls } = this.isLegalMaster(peer)
    p["LEGAL"] = allowed
    p["CLASS"] = cls

    p["CONNECTED"] = this.since(_peer_conf["CONNECTED"])
    p["CONNECTEDMS"] = _peer_conf["CONNECTED"] * 1000
    p["IP"] = _peer_conf["IP"]
    p["PORT"] = _peer_conf["PORT"]

    // Pre-allocate real-time monitor slots
    for (let ts = 1; ts <= 2; ts++)
      (p as any)[ts] = {
        TS: "",
        TYPE: "",
        SUB: "",
        SRC: "",
        DEST: "",
        TXRX: "",
      } as TimeslotData
  }

  // -------------------------------------------------------------------------
  // Stale-transmission cleanup
  // -------------------------------------------------------------------------

  /**
   * Clears timeslot entries that have not received an END event within
   * `intervalCleanTE` minutes (default 3).
   */
  cleanTE(): void {
    const timeout = Date.now() / 1000

    // Masters → peers → timeslots
    for (const system in __ctable__["MASTERS"]) {
      for (const peer in __ctable__["MASTERS"]![system]["PEERS"]) {
        for (let ts = 1; ts <= 2; ts++) {
          const ctabdata: TimeslotData = (
            __ctable__["MASTERS"]![system]["PEERS"][peer] as any
          )[ts]
          if (ctabdata["TS"]) {
            const td = Math.floor(Math.abs(ctabdata["TIMEOUT"]! - timeout) / 60)
            if (td > this.intervalCleanTE) this.clearTimeslot(ctabdata)
          }
        }
      }
    }

    // Standalone peers → timeslots
    for (const system in __ctable__["PEERS"]) {
      for (let ts = 1; ts <= 2; ts++) {
        const ctabdata: TimeslotData = (__ctable__["PEERS"][system] as any)[ts]
        if (ctabdata["TS"]) {
          const td = Math.floor(Math.abs(ctabdata["TIMEOUT"]! - timeout) / 60)
          if (td > this.intervalCleanTE) this.clearTimeslot(ctabdata)
        }
      }
    }

    // OpenBridges streams
    for (const system in __ctable__["OPENBRIDGES"]) {
      for (const streamId in __ctable__["OPENBRIDGES"][system]["STREAMS"]) {
        const ts = __ctable__["OPENBRIDGES"][system]["STREAMS"][streamId][3]
        const td = Math.floor(Math.abs(ts - timeout) / 60)
        if (td > this.intervalCleanTE)
          delete __ctable__["OPENBRIDGES"][system]["STREAMS"][streamId]
      }
    }
  }

  /** Resets all display fields on a timeslot object in-place. */
  private clearTimeslot(slot: TimeslotData): void {
    slot.TS = false
    slot.TXRX = ""
    slot.TYPE = ""
    slot.SUB = ""
    slot.SRC = ""
    slot.DEST = ""
  }

  // -------------------------------------------------------------------------
  // HBLink table builders
  // -------------------------------------------------------------------------

  /**
   * Performs an initial build of the ctable from the raw HBLink config pickle.
   *
   * `_config` keys are latin1 binary strings; `_stats_table` keys are decimal
   * strings.
   */
  build_hblink_table(_config: Record<string, any>, _stats_table: CTable): void {
    if (config.__loginfo__) logger.info("creating masters")

    for (const _hbp in _config) {
      const _hbp_data = _config[_hbp]
      if (!_hbp_data["ENABLED"]) continue

      if (_hbp_data["MODE"] === "MASTER") {
        _stats_table["MASTERS"] ??= {}
        _stats_table["MASTERS"][_hbp] ??= {
          REPEAT: _hbp_data["REPEAT"] ? "repeat" : "isolate",
          PEERS: {},
        }

        for (const _peer in _hbp_data["PEERS"]) {
          const peer = Buffer.from(_peer, "latin1").readUInt32BE().toString()
          this.add_hb_peer(
            _hbp_data["PEERS"][_peer],
            _stats_table["MASTERS"][_hbp]["PEERS"],
            peer,
          )
        }
        continue
      }

      if (
        (_hbp_data["MODE"] === "PEER" || _hbp_data["MODE"] === "XLXPEER") &&
        config.__homebrew_inc__
      ) {
        const { allowed, cls } = this.isLegalMaster(
          Buffer.from(_hbp_data["RADIO_ID"], "latin1")
            .readUInt32BE()
            .toString(),
        )

        const element: PeerStatsEntry = {
          MODE: _hbp_data["MODE"],
          LOCATION: _hbp_data["LOCATION"],
          CALLSIGN: _hbp_data["CALLSIGN"],
          RADIO_ID: Buffer.from(_hbp_data["RADIO_ID"], "latin1")
            .readUInt32BE()
            .toString(),
          MASTER_IP: _hbp_data["MASTER_IP"],
          MASTER_PORT: _hbp_data["MASTER_PORT"],
          LEGAL: allowed,
          CLASS: cls,
          LATITUDE: _hbp_data["LATITUDE"] ?? "0.0",
          LONGITUDE: _hbp_data["LONGITUDE"] ?? "0.0",
          HEIGHT: _hbp_data["HEIGHT"] ?? "0",
          SLOTS: "",
          STATS: {},
        }

        _stats_table["PEERS"][_hbp] = element

        // Populate STATS from XLXSTATS or plain STATS
        const statsSource =
          element["MODE"] === "XLXPEER"
            ? _hbp_data["XLXSTATS"]
            : _hbp_data["STATS"]

        element["STATS"]["CONNECTION"] = statsSource["CONNECTION"]

        if (statsSource["CONNECTION"] === "YES") {
          element["STATS"]["CONNECTED"] = this.since(statsSource["CONNECTED"])
          element["STATS"]["CONNECTEDMS"] = statsSource["CONNECTED"] * 1000
          element["STATS"]["PINGS_SENT"] = statsSource["PINGS_SENT"]
          element["STATS"]["PINGS_ACKD"] = statsSource["PINGS_ACKD"]
        } else {
          element["STATS"]["CONNECTED"] = "--   --"
          element["STATS"]["PINGS_SENT"] = 0
          element["STATS"]["PINGS_ACKD"] = 0
        }

        switch (_hbp_data["SLOTS"]) {
          case "0":
            element["SLOTS"] = "NONE"
            break
          case "1":
          case "2":
            element["SLOTS"] = _hbp_data["SLOTS"]
            break
          case "3":
            element["SLOTS"] = "1&2"
            break
          default:
            element["SLOTS"] = "DMO"
            break
        }

        // Pre-allocate real-time monitor slots
        for (let ts = 1; ts <= 2; ts++)
          (element as any)[ts] = {
            TS: "",
            TYPE: "",
            SUB: "",
            SRC: "",
            DEST: "",
          } as TimeslotData

        continue
      }

      if (_hbp_data["MODE"] === "OPENBRIDGE") {
        __ctable__["OPENBRIDGES"][_hbp] = {
          NETWORK_ID: Buffer.from(_hbp_data["NETWORK_ID"], "latin1")
            .readUInt32BE()
            .toString(),
          TARGET_IP: _hbp_data["TARGET_IP"],
          TARGET_PORT: _hbp_data["TARGET_PORT"],
          STREAMS: {},
        }
      }
    }
  }

  /**
   * Incrementally updates the ctable: adds new peers, removes departed ones,
   * refreshes connection-time display strings, and triggers cleanTE / build_stats.
   *
   * `_config` keys are latin1 binary strings; `_stats_table` keys are decimal
   * strings.
   */
  update_hblink_table(
    _config: Record<string, any>,
    _stats_table: CTable,
  ): void {
    if (config.__loginfo__) logger.info("updating masters")

    // Add newly registered peers
    for (const _hbp in _config) {
      const _hbp_data = _config[_hbp]
      if (_hbp_data["MODE"] !== "MASTER") continue

      for (const _peer in _hbp_data["PEERS"]) {
        const peer = Buffer.from(_peer, "latin1").readUInt32BE().toString()
        if (
          _stats_table["MASTERS"]![_hbp]["PEERS"][peer] == null &&
          _hbp_data["PEERS"][_peer]["CONNECTION"] === "YES"
        ) {
          this.add_hb_peer(
            _hbp_data["PEERS"][_peer],
            _stats_table["MASTERS"]![_hbp]["PEERS"],
            peer,
          )
        }
      }
    }

    // Remove peers that have been dropped from HBLink config
    for (const _hbp in _stats_table["MASTERS"]) {
      const _hbp_data = _config[_hbp]
      if (_hbp_data?.["MODE"] !== "MASTER") continue

      const remove_list: string[] = []
      for (const peer in _stats_table["MASTERS"]![_hbp]["PEERS"]) {
        const _peer = this.ReverseEndian(peer)
        if (_hbp_data["PEERS"][_peer] == null) {
          if (config.__loginfo__)
            logger.info(`peer id=${peer} marked for deletion`)
          remove_list.push(peer)
        }
      }
      for (const peer of remove_list) {
        if (config.__loginfo__) logger.info(`deleting peer id=${peer}`)
        delete _stats_table["MASTERS"]![_hbp]["PEERS"][peer]
      }
    }

    // Refresh connection-time display strings for masters
    for (const _hbp in _stats_table["MASTERS"]) {
      for (const peer in _stats_table["MASTERS"]![_hbp]["PEERS"]) {
        const _peer = this.ReverseEndian(peer)
        const raw = _config[_hbp]?.["PEERS"]?.[_peer]
        if (raw != null) {
          _stats_table["MASTERS"]![_hbp]["PEERS"][peer]["CONNECTED"] =
            this.since(raw["CONNECTED"])
          _stats_table["MASTERS"]![_hbp]["PEERS"][peer]["CONNECTEDMS"] =
            raw["CONNECTED"] * 1000
        }
      }
    }

    // Refresh STATS for standalone peers
    for (const _hbp in _stats_table["PEERS"]) {
      const stabdata = _stats_table["PEERS"][_hbp]["STATS"]
      const statsSource: Record<string, any> =
        _stats_table["PEERS"][_hbp]["MODE"] === "XLXPEER"
          ? _config[_hbp]["XLXSTATS"]
          : _config[_hbp]["STATS"]

      if (statsSource["CONNECTION"] === "YES") {
        stabdata["CONNECTED"] = this.since(statsSource["CONNECTED"])
        stabdata["CONNECTEDMS"] = statsSource["CONNECTED"] * 1000
        stabdata["CONNECTION"] = statsSource["CONNECTION"]
        stabdata["PINGS_SENT"] = statsSource["PINGS_SENT"]
        stabdata["PINGS_ACKD"] = statsSource["PINGS_ACKD"]
      } else {
        stabdata["CONNECTED"] = "--   --"
        stabdata["CONNECTION"] = statsSource["CONNECTION"]
        stabdata["PINGS_SENT"] = 0
        stabdata["PINGS_ACKD"] = 0
      }
    }

    this.cleanTE()
    this.build_stats()
  }

  // -------------------------------------------------------------------------
  // Bridge table
  // -------------------------------------------------------------------------

  /** Transforms the raw bridge pickle into a display-ready nested structure. */
  build_bridge_table(_bridges: Record<string, any>): BTable["BRIDGES"] {
    const _stats_table: BTable["BRIDGES"] = {}
    const _now = Date.now() / 1000
    const hideSystems = new Set<string>(config.__bridges_params__.hide)

    for (const bridge in _bridges) {
      _stats_table[bridge] = {}
      const tgbridges = _bridges[bridge]

      for (const currentTgName in tgbridges) {
        const system: Record<string, any> = tgbridges[currentTgName]

        if (hideSystems.has(system["SYSTEM"])) continue

        if (!system["ACTIVE"] && !config.__bridges_params__.showDisconnected)
          continue

        let exptime: string
        let to_action: string

        if (system["TO_TYPE"] === "ON" || system["TO_TYPE"] === "OFF") {
          exptime =
            system["TIMER"] > _now ? String(system["TIMER"] - _now) : "Expired"
          to_action = system["TO_TYPE"] === "ON" ? "Disconnect" : "Connect"
        } else {
          exptime = "n/a"
          to_action = "None"
        }

        const active: string = system["ACTIVE"] ? "Connected" : "Disconnected"

        const trigOn = (system["ON"] as string[])
          .map((v) => Buffer.from(v, "latin1").readUIntBE(0, v.length))
          .join(",")

        const trigOff = (system["OFF"] as string[])
          .map((v) => Buffer.from(v, "latin1").readUIntBE(0, v.length))
          .join(",")

        let tgid: number = Buffer.from(system["TGID"], "latin1").readIntBE(
          0,
          system["TGID"].length,
        )
        const aliasKey = String(tgid)
        const bridgeAlias = config.__bridges_params__.alias as Record<
          string,
          string | number
        >
        if (bridgeAlias[aliasKey] != null)
          tgid = parseInt(String(bridgeAlias[aliasKey]), 10)

        const entry: BridgeTgEntry = {
          TGID: tgid,
          TS: system["TS"],
          EXP_TIME: exptime,
          TO_ACTION: to_action,
          ACTIVE: active,
          TRIG_ON: trigOn,
          TRIG_OFF: trigOff,
        }

        if (_stats_table[bridge][system["SYSTEM"]])
          _stats_table[bridge][system["SYSTEM"]].push(entry)
        else _stats_table[bridge][system["SYSTEM"]] = [entry]
      }
    }

    return _stats_table
  }

  // -------------------------------------------------------------------------
  // Analytics helpers
  // -------------------------------------------------------------------------

  /**
   * Returns the peers for a given master sorted by descending online time
   * as an array of `[peerId, peerEntry]` tuples.
   */
  sortMastersPeersByOnlineTime(
    peers: Record<string, PeerEntry>,
  ): Array<[string, PeerEntry]> {
    const peersArray = Object.entries(peers) as Array<[string, PeerEntry]>

    for (const pair of peersArray) {
      const record = pair[1]
      const parts = record["CONNECTED"].split(" ")
      let onlineSecs = 0

      switch (parts.length) {
        case 3:
          // "DDDd HHh" — legacy 3-part form (days / hours / ?)
          onlineSecs =
            parseInt(parts[0]) * 86400 +
            parseInt(parts[1]) * 3600 +
            parseInt(parts[2])
          break
        case 2: {
          const suffix = parts[0].slice(-1)
          if (suffix === "d")
            onlineSecs = parseInt(parts[0]) * 86400 + parseInt(parts[1]) * 3600
          else if (suffix === "h")
            onlineSecs = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60
          else if (suffix === "m")
            onlineSecs = parseInt(parts[0]) * 60 + parseInt(parts[1])
          break
        }
        case 1:
          onlineSecs = parseInt(parts[0])
          break
        default:
          onlineSecs = 0
      }

      record["ONLINE"] = String(onlineSecs)
    }

    return peersArray.sort(
      ([, a], [, b]) => parseInt(b["ONLINE"]!) - parseInt(a["ONLINE"]!),
    )
  }

  /** Reads (or initialises) the analytics JSON file, updates it, and returns it. */
  buildAnalytics(): Analytics {
    let analytics: Analytics

    if (fs.existsSync(`${config.__log_path__}${config.__analytics__}`)) {
      analytics = JSON.parse(
        fs.readFileSync(
          `${config.__log_path__}${config.__analytics__}`,
          "utf-8",
        ),
      )

      // Ensure nested structure exists (backwards-compatibility)
      analytics["analytics"] ??= { masters: { onlinebyhour: [], hotspots: [] } }
      analytics["analytics"]["masters"] ??= { onlinebyhour: [], hotspots: [] }
      analytics["analytics"]["masters"]["hotspots"] ??= []
      analytics["analytics"]["masters"]["onlinebyhour"] ??= new Array(
        TIME_INTERVALS,
      ).fill(0)

      // Pad to new length if the file pre-dates TIME_INTERVALS change
      if (
        analytics["analytics"]["masters"]["onlinebyhour"].length <
        TIME_INTERVALS
      )
        analytics["analytics"]["masters"]["onlinebyhour"].push(0)
    } else {
      analytics = {
        analytics: {
          masters: {
            onlinebyhour: new Array(TIME_INTERVALS).fill(0),
            hotspots: [],
          },
        },
      }
    }

    const hotspots = analytics["analytics"]["masters"]["hotspots"]
    const masters = __ctable__["MASTERS"]

    if (masters == null) return (__analytics__ = analytics)

    const date = new Date()
    const lastSeen = Date.now()
    let onlineCount = 0

    for (const entry in masters) {
      if (!Object.keys(masters[entry]["PEERS"]).length) continue

      const peers = this.sortMastersPeersByOnlineTime(masters[entry]["PEERS"])

      try {
        for (const [netID, record] of peers) {
          const hardwareType =
            record["RX_FREQ"] === "N/A" && record["TX_FREQ"] === "N/A"
              ? "IP Network"
              : "Radio"

          if (record["SLOTS"].startsWith("Slot")) record["SLOTS"] = "VOIP"

          const parsedTime = utils.parseElapsedTime(record["CONNECTED"])

          if (
            parsedTime != null &&
            ((parsedTime.days && parsedTime.days > 0) ||
              (parsedTime.hours && parsedTime.hours > 0) ||
              (parsedTime.minutes && parsedTime.minutes > 4))
          ) {
            onlineCount++
          }

          const blob: AnalyticsHotspotBlob = {
            name: entry,
            repeat: masters[entry]["REPEAT"],
            callsign: record["CALLSIGN"]?.length ? record["CALLSIGN"] : "n/a",
            location: record["LOCATION"]?.length ? record["LOCATION"] : "n/a",
            netid: netID,
            type: hardwareType,
            ip: record["IP"],
            slot: record["SLOTS"],
            version: record["SOFTWARE_ID"],
            Hardware: record["PACKAGE_ID"],
            legal: record["LEGAL"],
            cnxTime: Math.floor(record["CONNECTEDMS"]),
            parsedTime: parsedTime as unknown as Record<string, number> | null,
            lastseen: lastSeen,
          }

          const alreadyKnown = hotspots.some(
            (item) => Object.keys(item)[0] === entry,
          )
          if (!alreadyKnown) {
            blob.firstseen = lastSeen
            hotspots.push({ [entry]: blob })
          }
        }
      } catch {
        // Non-fatal; skip malformed peer records
      }
    }

    const hourIdx = date.getHours()

    if (
      !analytics["analytics"]["masters"]["onlinebyhour"][hourIdx] ||
      config.__hotspotMonitoring__
    ) {
      analytics["analytics"]["masters"]["onlinebyhour"][hourIdx] = onlineCount

      if (config.__hotspotMonitoring__) {
        for (let h = hourIdx + 1; h < TIME_INTERVALS; h++)
          analytics["analytics"]["masters"]["onlinebyhour"][h] = 0
      }
    } else {
      analytics["analytics"]["masters"]["onlinebyhour"][hourIdx] =
        (analytics["analytics"]["masters"]["onlinebyhour"][hourIdx] +
          onlineCount) /
        2
    }

    fs.writeFileSync(
      `${config.__log_path__}${config.__analytics__}`,
      JSON.stringify(analytics, null, 2),
      { encoding: "utf-8", flag: "w" },
    )

    return (__analytics__ = analytics)
  }

  // -------------------------------------------------------------------------
  // Stats broadcast
  // -------------------------------------------------------------------------

  /** Builds analytics and pushes state to all connected WebSocket clients. */
  build_stats(): void {
    this.now = Date.now()

    if (this.now <= this.build_time + 500 || this.dashboardServer == null)
      return

    this.buildAnalytics()
    ;(this.dashboardServer as any).clients.forEach((ws: any) => {
      if (!ws.fromPage) return

      if (ws.page === "logbook") {
        ws.send(
          JSON.stringify({
            BIGEARS: (this.dashboardServer as any).clients.size.toString(),
            LISTENERS: __listeners__,
            DIAGNOSTICS: this.build_Diagnostic_table(),
          }),
        )
        return
      }

      if (ws.page === "dashboard" || ws.page === "aprs") {
        ws.send(
          JSON.stringify({
            CTABLE: __ctable__,
            ANALYTICS: __analytics__,
            EMPTY_MASTERS: config.__empty_masters__,
            BIGEARS: (this.dashboardServer as any).clients.size.toString(),
            LISTENERS: __listeners__,
            DIAGNOSTICS: this.build_Diagnostic_table(),
          }),
        )
      } else {
        ws.send(
          JSON.stringify({
            CTABLE: __ctable__,
            BTABLE: { BRIDGES: __btable__["BRIDGES"] },
            BIGEARS: (this.dashboardServer as any).clients.size.toString(),
            LISTENERS: __listeners__,
            DIAGNOSTICS: this.build_Diagnostic_table(),
          }),
        )
      }
    })

    this.mapIpAdresses()
    this.build_time = this.now
  }

  // -------------------------------------------------------------------------
  // Real-time system update
  // -------------------------------------------------------------------------

  /** Processes a BRDG_EVENT payload array and updates the in-memory ctable. */
  rts_update(p: string[]): void {
    const callType: string = p[0]
    const action: string = p[1]
    const trx: string = p[2]
    const system: string = p[3]
    const streamId: string = p[4]
    const sourcePeer: number = parseInt(p[5], 10)
    const sourceSub: string = p[6]
    const timeSlot: number = parseInt(p[7], 10)
    const destination: string = p[8]
    const timeout: number = Date.now() / 1000

    // ----- Masters -----
    const masterPeers = __ctable__["MASTERS"]?.[system]?.["PEERS"]
    if (masterPeers != null) {
      for (const peer in masterPeers) {
        const ctabdata: TimeslotData = (masterPeers[peer] as any)[timeSlot]

        if (action === "START") {
          ctabdata["TIMEOUT"] = timeout
          ctabdata["TS"] = true
          ctabdata["TXRX"] =
            sourcePeer == null || p[5] === "" || peer == null || peer === ""
              ? ""
              : sourcePeer === parseInt(peer, 10)
                ? "TX"
                : "RX"
          ctabdata["TYPE"] = callType
          ctabdata["SRC"] = peer
          ctabdata["SUB"] =
            sourceSub.length < 7
              ? `${utils.peer_short(sourceSub, __peers_ids__ ?? [])} (${sourceSub})`
              : `${utils.alias_short(sourceSub, __subscriber_ids__ ?? [])} (${sourceSub})`
          ctabdata["DEST"] =
            `${utils.alias_tgid(destination, __talkgroup_ids__ ?? [])} (${destination})`
          ctabdata["TGID"] = destination

          const networkData = utils.getNetWorkPicture(
            ctabdata["TGID"]!,
            ctabdata["DEST"],
          )
          if (networkData) {
            ctabdata["TGIMG"] = networkData.TGIMG
            ctabdata["ALIAS"] = networkData.ALIAS
          }
        }

        if (action === "END") {
          this.clearTimeslot(ctabdata)
          ctabdata["TGID"] = ""
          ctabdata["TGIMG"] = ""
          this.extra.rts_update(parseInt(destination, 10))
        }
      }
    }

    // ----- OpenBridges -----
    if (__ctable__["OPENBRIDGES"][system]) {
      if (action === "START") {
        __ctable__["OPENBRIDGES"][system]["STREAMS"][streamId] = [
          trx,
          sourceSub.length < 7
            ? utils.peer_call(sourceSub, __peers_ids__ ?? [])
            : utils.alias_call(sourceSub, __subscriber_ids__ ?? []),
          `TG${destination}`,
          timeout,
        ]
      } else if (
        action === "END" &&
        __ctable__["OPENBRIDGES"][system]["STREAMS"][streamId]
      ) {
        delete __ctable__["OPENBRIDGES"][system]["STREAMS"][streamId]
      }
    }

    // ----- Standalone peers -----
    if (__ctable__["PEERS"][system]) {
      const ctabdata: TimeslotData = (__ctable__["PEERS"][system] as any)[
        timeSlot
      ]

      if (action === "START") {
        ctabdata["TIMEOUT"] = timeout
        ctabdata["TS"] = true
        ctabdata["SUB"] =
          `${sourceSub.length < 7 ? utils.alias_short(sourceSub, __peers_ids__ ?? []) : utils.alias_short(sourceSub, __subscriber_ids__ ?? [])} (${sourceSub})`
        ctabdata["SRC"] = sourcePeer
        ctabdata["DEST"] =
          `${utils.alias_tgid(destination, __talkgroup_ids__ ?? [])} (${destination})`
        ctabdata["TGID"] = destination

        const networkData = utils.getNetWorkPicture(
          ctabdata["TGID"]!,
          ctabdata["DEST"],
        )
        ctabdata["TGIMG"] = networkData?.["TGIMG"] ?? ""
        ctabdata["DEST"] = networkData?.["ALIAS"] ?? ctabdata["DEST"]
        ctabdata["TXRX"] =
          sourcePeer == null || sourceSub == null || destination == null
            ? ""
            : trx
      }

      if (action === "END") {
        this.clearTimeslot(ctabdata)
        ctabdata["TGID"] = ""
        ctabdata["TGIMG"] = ""
      }
    }

    this.build_stats()
  }

  // -------------------------------------------------------------------------
  // Constructor & socket management
  // -------------------------------------------------------------------------

  // https://stackoverflow.com/questions/25791436/reconnect-net-socket-nodejs
  constructor(monitor: Monitor, address: string, port: number) {
    if (config.__proxyServerPort__ != null) {
      this.socketProxy = new SocketProxy()
      this.socketProxy?.init()
    }

    this.opbNotAllowed = new Set<string>()
    this.monitor = monitor
    this.dashboardServer = monitor.dashboardServer

    this.diagnostics = new diags.Diagnostics()
    this.diagnostics.runCheck()

    __ctable__ = { PEERS: {}, OPENBRIDGES: {} }

    // Apply optional padding overrides from config
    const padding: PaddingConfig | undefined =
      config.__extra_settings__?.masters?.padding
    if (padding) {
      this.dayPadding = padding.days ?? 3
      this.hourPadding = padding.hours ?? 2
      this.minutePadding = padding.minutes ?? 2
      this.secondsPadding = padding.seconds ?? 2
    }

    // Periodic stats broadcast
    try {
      setInterval(() => this.build_stats(), config.__frequency__ * 1000)
      logger.info(
        `reporter build stats activated at a ${config.__frequency__}s interval\n`,
      )
    } catch (e: unknown) {
      logger.info(`Error in build stats: ${(e as Error).toString()}`)
    }

    this.pickleparser = new PickleParser()
    this.client = new netsocket.Socket()
    this.client.setKeepAlive(true, 5000)

    // ---- Socket error / close / end handlers ----

    this.client.on("error", () => {
      if (!config.testMode) {
        logger.info("server socket error")
        launchIntervalConnect()
      }
    })

    this.client.on("close", () => {
      if (!config.testMode) {
        logger.info("server socket closed")
        launchIntervalConnect()
      }
    })

    this.client.on("end", () => {
      if (!config.testMode) {
        logger.info("server socket ended")
        launchIntervalConnect()
      }
    })

    // ---- Reconnection logic ----

    const connect = (): void => {
      logger.info("connecting to HBLink/FreeDMR server")
      this.client!.removeAllListeners("data")

      if (this.netstring !== null) {
        this.netstring.kill()
        this.netstring = null
      }

      this.client!.connect({ port, host: address }, () => {
        logger.info(`monitoring server ${address}:${port}`)
      })
    }

    const launchIntervalConnect = (): void => {
      if (this.reconnectTicker != null) return

      this.reconnectTicker = setInterval(() => {
        if (this.reconnectTries-- > 0) {
          logger.info(
            `reconnection attempt ${MAXTRIES - this.reconnectTries}/${MAXTRIES}`,
          )
          connect()
        } else {
          clearInterval(this.reconnectTicker!)
          this.reconnectTicker = null
          logger.info(`reconnection ${globals.__FAILED__}, check server`)
        }
      }, 5000)
    }

    const clearIntervalConnect = (): void => {
      if (this.reconnectTicker != null) {
        clearInterval(this.reconnectTicker)
        this.reconnectTicker = null
      }
    }

    // ---- Data processing ----

    const treatConnection = (): void => {
      clearIntervalConnect()

      /**
       * Callback invoked by the NetString framer for each complete packet.
       */
      ;(this.client as EnhancedSocket).gotBox = (data: Buffer) => {
        if (config.__loginfo__) logger.info("gotBox")

        const opcode: number = data[0]
        const message: Buffer = data.subarray(1)
        const now: string = this.strftimeNow()

        switch (opcode) {
          // ----------------------------------------------------------------
          case Opcodes.CONFIG_SND:
            try {
              const unpickled = this.pickleparser!.load(message)

              // Check if we got valid data
              if (!unpickled || typeof unpickled !== "object") {
                logger.info("Invalid or empty pickle data received")
                break
              }

              // Cast to Record with safety
              const dataObj = unpickled as Record<string, any>

              if (__ctable__["MASTERS"] == null) {
                if (config.__loginfo__) logger.info("build_hblink_table")
                this.build_hblink_table(dataObj, __ctable__)
              } else {
                if (config.__loginfo__) logger.info("update_hblink_table")
                this.update_hblink_table(dataObj, __ctable__)
              }
            } catch (error) {
              logger.error(`__ctable__ build/update error: ${error}`)
              // Log more details for debugging
              if (config.__loginfo__) {
                logger.info(`Failed message length: ${message.length}`)
                logger.info(
                  `First 50 bytes: ${message.subarray(0, 50).toString("hex")}`,
                )
              }
            }
            break

          // ----------------------------------------------------------------
          case Opcodes.BRIDGE_SND:
            if (this.pickleparser == null) {
              logger.info("pickleparser is null, cannot load bridges")
              break
            }
            __bridges__ = this.pickleparser.load(message)
            __bridges_rx__ = this.strftime(new Date())
            if (config.__bridges_inc__ && __bridges__ != null)
              __btable__["BRIDGES"] = this.build_bridge_table(
                __bridges__ as Record<string, any>,
              )
            break

          // ----------------------------------------------------------------
          case Opcodes.LINK_EVENT:
            logger.info(`LINK_EVENT Received: ${message}`)
            break

          // ----------------------------------------------------------------
          case Opcodes.BRDG_EVENT: {
            if (config.__loginfo__) logger.info(`BRIDGE EVENT: ${message}`)

            const p = message.toString().split(",")

            const REPORT_TGID: string = p[8]

            if (
              !this.monitor!.IsTgidAllowed(REPORT_TGID) &&
              !config.tgid_allow_obp_and_masters
            )
              break

            const REPORT_TYPE: string = p[0]
            const REPORT_RXTX: string = p[2]
            const REPORT_SYS: string = p[3]
            const REPORT_SRC_ID: string = p[5]

            this.rts_update(p)

            // Filter by OBP backend allow-list
            const backendAllowList: string[] | undefined =
              config.__opb_backend__[REPORT_SYS]
            if (backendAllowList != null) {
              const found = backendAllowList.includes(REPORT_SRC_ID)
              if (!found) {
                if (!this.opbNotAllowed!.has(REPORT_SYS)) {
                  this.opbNotAllowed!.add(REPORT_SYS)
                  logger.info(
                    `BACKEND OBP '${REPORT_SYS}' WITH ID='${REPORT_SRC_ID}' NOT ALLOWED`,
                  )
                }
                return
              }
            }

            if (
              monitor.IsTgidAllowed(REPORT_TGID) &&
              REPORT_TYPE === "GROUP VOICE" &&
              REPORT_RXTX !== "TX" &&
              !this.opbfilter.has(REPORT_SRC_ID)
            ) {
              const REPORT_DATE: string = now.substring(0, 10)
              const REPORT_TIME: string = now.substring(11, 19)
              const REPORT_PACKET: string = p[1]
              const REPORT_DMRID: string = p[6]
              const REPORT_TS: string = p[7]

              let REPORT_ALIAS: string = utils.alias_tgid(
                REPORT_TGID,
                __talkgroup_ids__ ?? [],
              )
              const callfname: [string, string] =
                REPORT_DMRID.length < 7
                  ? utils.peer_only(REPORT_DMRID, __peers_ids__ ?? [])
                  : utils.alias_only(REPORT_DMRID, __subscriber_ids__ ?? [])
              const REPORT_CALLSIGN: string = callfname[0].trim()
              const REPORT_FNAME: string = callfname[1].trim()
              let REPORT_TGIMG: string = ""

              const networkData = utils.getNetWorkPicture(
                REPORT_TGID,
                REPORT_ALIAS,
              )
              if (networkData) {
                REPORT_TGIMG = networkData.TGIMG
                REPORT_ALIAS = networkData.ALIAS
              }

              let jsonStr: Partial<TrafficEntry> & Record<string, unknown>

              if (REPORT_PACKET === "END") {
                const REPORT_DELAY = parseInt(p[9], 10)

                jsonStr = {
                  DATE: REPORT_DATE,
                  TIME: REPORT_TIME,
                  TYPE: REPORT_TYPE.substring(6),
                  PACKET: REPORT_PACKET,
                  SYS: REPORT_SYS,
                  SRC_ID: REPORT_SRC_ID,
                  TS: REPORT_TS,
                  TGID: REPORT_TGID,
                  ALIAS: REPORT_ALIAS,
                  TGIMG: REPORT_TGIMG,
                  DMRID: REPORT_DMRID,
                  CALLSIGN: REPORT_CALLSIGN,
                  NAME: REPORT_FNAME,
                  DELAY: REPORT_DELAY,
                }
                this.updateLastheard(jsonStr)

                if (config.__lastheard_inc__ && REPORT_DELAY > 0) {
                  const dt = new Date()
                  const diffTZ = dt.getTimezoneOffset() / -60
                  const tzStr = diffTZ < 0 ? String(diffTZ) : `+${diffTZ}`
                  const buffer =
                    `${this.strftime(new Date())} UTC${tzStr},${REPORT_DELAY},` +
                    `${REPORT_TYPE},${REPORT_PACKET},${REPORT_SYS},${REPORT_SRC_ID},` +
                    `${utils.alias_call(REPORT_SRC_ID, __subscriber_ids__ ?? [])},TS${REPORT_TS},` +
                    `TG${REPORT_TGID},${REPORT_ALIAS},${REPORT_DMRID},${callfname}\n`

                  const logPath = `${config.__log_path__}${config.__lastheard_log__}`
                  if (fs.existsSync(logPath))
                    fs.appendFileSync(logPath, buffer, "utf-8")
                  else fs.writeFileSync(logPath, buffer, "utf-8")
                }
              } else if (REPORT_PACKET === "START") {
                jsonStr = {
                  DATE: REPORT_DATE,
                  TIME: REPORT_TIME,
                  TYPE: REPORT_TYPE.substring(6),
                  PACKET: REPORT_PACKET,
                  SYS: REPORT_SYS,
                  SRC_ID: REPORT_SRC_ID,
                  TS: REPORT_TS,
                  TGID: REPORT_TGID,
                  ALIAS: REPORT_ALIAS,
                  TGIMG: REPORT_TGIMG,
                  DMRID: REPORT_DMRID,
                  CALLSIGN: REPORT_CALLSIGN,
                  NAME: REPORT_FNAME,
                  DELAY: 0,
                }
                this.updateLastheard(jsonStr)
              } else if (REPORT_PACKET === "END WITHOUT MATCHING START") {
                jsonStr = {
                  DATE: REPORT_DATE,
                  TIME: REPORT_TIME,
                  TYPE: REPORT_TYPE.substring(6),
                  PACKET: REPORT_PACKET,
                  SYS: REPORT_SYS,
                  SRC_ID: REPORT_SRC_ID,
                  TS: REPORT_TS,
                  TGID: REPORT_TGID,
                  ALIAS: REPORT_ALIAS,
                  TGIMG: REPORT_TGIMG,
                  DMRID: REPORT_DMRID,
                  CALLSIGN: REPORT_CALLSIGN,
                  NAME: REPORT_FNAME,
                  DELAY: 0,
                }
              } else {
                jsonStr = {
                  DATE: now.substring(0, 10),
                  TIME: now.substring(10),
                  PACKET: "UNKNOWN GROUP VOICE LOG MESSAGE",
                }
              }

              this.broadcast({
                TRAFFIC: jsonStr,
                BIGEARS: (this.dashboardServer as any).clients.size.toString(),
              })
            }
            break
          }

          // ----------------------------------------------------------------
          default:
            this.netstring!.reSync()

            if (opcode) {
              // Opcode 98 is a known benign trailing notification — ignore it
              if (opcode === 98) break
              logger.info(`got unknown opcode: ${opcode.toString()}`)
            } else {
              logger.info("got null opcode")
            }
        }
      }

      // Reset pickle parser state
      this.pickleparser!.reSync()

      // Instantiate the netstring framer
      this.netstring = new NetStringReceiver(
        (this.client as EnhancedSocket).gotBox,
      )

      // Wire up the data listener
      this.client!.on("data", (data: Buffer) => {
        if (this.socketProxy) this.socketProxy.broadcast(data)
        this.netstring!.dataReceived(data)
      })
    }

    this.client.on("connect", () => treatConnection())

    connect()

    if (config.testMode) {
      treatConnection()
      this.simulateCtable()
    }
  }

  // -------------------------------------------------------------------------
  // Test / simulation helpers
  // -------------------------------------------------------------------------

  simulateCtable(): void {
    try {
      setInterval(() => {
        this.packetCount = 0
        while (true) {
          const filename = `${config.__log_path__}trace/hblink${this.packetCount++}.pick`
          if (!fs.existsSync(filename)) break
          this.netstring!.dataReceived(fs.readFileSync(filename))
        }
      }, 10_000)
    } catch {
      // Simulation is best-effort; swallow errors
    }
  }

  // -------------------------------------------------------------------------
  // Misc
  // -------------------------------------------------------------------------

  /** No-op placeholder — reserved for future table cleanup logic. */
  cleanup(): void {
    /* intentionally empty */
  }

  /**
   * Prepends a new traffic entry to the in-memory log and persists it to disk.
   */
  updateLastheard(jsonStr: Record<string, unknown>): void {
    this.monitor!.__traffic__.unshift(jsonStr)
    this.monitor!.__traffic__.length = Math.min(
      this.monitor!.__traffic__.length,
      config.__traffic_size__,
    )
    fs.writeFileSync(
      `${config.__log_path__}lastheard.json`,
      JSON.stringify({ TRAFFIC: this.monitor!.__traffic__ }),
      "utf-8",
    )
  }

  /**
   * Sends a JSON payload to all connected WebSocket clients, applying
   * per-client TGID filter rules for non-page (API) consumers.
   */
  broadcast(data: Record<string, unknown>): void {
    ;(this.dashboardServer as any).clients.forEach((ws: any) => {
      if (ws.fromPage) {
        ws.send(JSON.stringify(data))
        return
      }

      // API / socket-service client — apply TGID allow-list
      const t: Record<string, any> = data["TRAFFIC"] as Record<string, any>
      const requestip: string = ws._socket.remoteAddress.replace(/^.*:/, "")

      // Strip transient field before forwarding
      delete t["BIGEARS"]

      if (config.__allowed__socket_clients__ == null) return

      for (const item of config.__allowed__socket_clients__) {
        if (item.ipaddress !== requestip) continue

        if (item.tglist.length === 0) {
          ws.send(JSON.stringify(data))
          break
        }

        let valid = false
        for (const pattern of item.tglist) {
          if (pattern === t.TGID) {
            valid = true
            break
          }

          const starIdx = pattern.indexOf("*")
          if (
            starIdx !== -1 &&
            t.TGID.startsWith(pattern.substring(0, starIdx))
          ) {
            valid = true
            break
          }

          const rangeIdx = pattern.indexOf("..")
          if (rangeIdx !== -1) {
            const lo = parseInt(pattern.substring(0, rangeIdx), 10)
            const hi = parseInt(pattern.substring(rangeIdx + 2), 10)
            const tg = parseInt(t.TGID, 10)
            if (lo <= tg && tg <= hi) {
              valid = true
              break
            }
          }
        }

        if (valid) ws.send(JSON.stringify(data))
        break
      }
    })
  }

  // -------------------------------------------------------------------------
  // Date / time formatting
  // -------------------------------------------------------------------------

  strftime(d: Date): string {
    const pad = (n: number, w = 2): string => String(n).padStart(w, "0")
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
      `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(Math.trunc(d.getSeconds()))}`
    )
  }

  strftimeNow(): string {
    return this.strftime(new Date())
  }
}

// ---------------------------------------------------------------------------
// Module-level state (mirrored from original)
// ---------------------------------------------------------------------------

let currentDiag: any = []
