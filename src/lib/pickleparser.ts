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
 *  Based on the work of Jeremy Lainé on github https://www.npmjs.com/package/jpickle
 *  Copyright(c) 2023-26 F4JDN - Jean-Michel Cohen
 *
 */

import fs from "fs"
import { logger } from "../monitor.js"
import * as config from "../config.js"

// Opcodes – protocol 0, 1, and 2
const OP = {
  MARK: "(",
  STOP: ".",
  POP: "\x00",
  POP_MARK: "\x01",
  DUP: "\x02",
  FLOAT: "F",
  INT: "I",
  BININT: "J",
  BININT1: "K",
  LONG: "L",
  BININT2: "M",
  NONE: "N",
  REDUCE: "R",
  STRING: "S",
  BINSTRING: "T",
  SHORT_BINSTRING: "U",
  UNICODE: "V",
  BINUNICODE: "X",
  APPEND: "a",
  BUILD: "b",
  GLOBAL: "c",
  DICT: "d",
  EMPTY_DICT: "}",
  APPENDS: "e",
  GET: "g",
  BINGET: "h",
  LONG_BINGET: "j",
  LIST: "l",
  EMPTY_LIST: "]",
  OBJ: "o",
  PUT: "p",
  BINPUT: "q",
  LONG_BINPUT: "r",
  SETITEM: "s",
  TUPLE: "t",
  EMPTY_TUPLE: ")",
  SETITEMS: "u",
  BINFLOAT: "G",
  // protocol 2
  PROTO: "\x80",
  NEWOBJ: "\x81",
  TUPLE1: "\x85",
  TUPLE2: "\x86",
  TUPLE3: "\x87",
  NEWTRUE: "\x88",
  NEWFALSE: "\x89",
  LONG1: "\x8a",
  LONG4: "\x8b",
} as const

type EmulatedFn = (args: unknown[]) => unknown

type ReadLineBuffer = Buffer & { readLine(offset: number): Buffer }

export class PickleParser {
  private readonly MARK_TOKEN = "THIS-NEEDS-TO-BE-UNIQUE-TO-SERVE-AS-A-BOUNDARY"

  private memo: Record<string, unknown> = {}
  private stack: unknown[] = []

  private readonly emulated: Record<string, EmulatedFn> = {
    "datetime.datetime": (args: unknown[]): Date => {
      const tmp = Buffer.from(args[0] as string, "binary")
      const year = tmp.readUInt16BE(0)
      const month = tmp.readUInt8(2) - 1
      const day = tmp.readUInt8(3)
      const hour = tmp.readUInt8(4)
      const minute = tmp.readUInt8(5)
      const second = tmp.readUInt8(6)
      const microsecond = tmp.readUInt32BE(6) & 0xffffff

      if (args[1] === "UTC") {
        return new Date(
          Date.UTC(year, month, day, hour, minute, second, microsecond / 1000),
        )
      }
      return new Date(
        year,
        month,
        day,
        hour,
        minute,
        second,
        microsecond / 1000,
      )
    },

    "_codecs.encode": (args: unknown[]): unknown => args[0],

    "__builtin__.bytes": (args: unknown[]): unknown => args[0],

    "collections.deque": (args: unknown[]): unknown => args[0],
  }

  reSync(): void {
    this.memo = {}
    this.stack = []
  }

  private marker(): number {
    let k = this.stack.length - 1
    while (k > 0 && this.stack[k] !== this.MARK_TOKEN) --k
    return k
  }

  private readLine(buffer: Buffer, offset: number): Buffer {
    const index = buffer.indexOf("\n", offset)
    if (index === -1) throw new Error("Could not find end of line")
    return buffer.subarray(offset, index)
  }

  load(pickle: Buffer): unknown {
    const buffer = pickle as ReadLineBuffer
    buffer.readLine = (i: number) => this.readLine(buffer, i)
    let i = 0

    while (i < buffer.length) {
      const opcode = String.fromCharCode(buffer[i++])

      switch (opcode) {
        // ── Protocol version ────────────────────────────────────────────────
        case OP.PROTO: {
          const proto = buffer.readUInt8(i++)
          if (proto !== 2)
            throw new Error(`Unhandled pickle protocol version: ${proto}`)
          break
        }

        // ── Tuples ──────────────────────────────────────────────────────────
        case OP.TUPLE1: {
          const a = this.stack.pop()
          this.stack.push([a])
          break
        }
        case OP.TUPLE2: {
          const b = this.stack.pop()
          const a = this.stack.pop()
          this.stack.push([a, b])
          break
        }
        case OP.TUPLE3: {
          const c = this.stack.pop()
          const b = this.stack.pop()
          const a = this.stack.pop()
          this.stack.push([a, b, c])
          break
        }
        case OP.TUPLE:
        case OP.LIST: {
          const mark = this.marker()
          const list = this.stack.slice(mark + 1)
          this.stack = this.stack.slice(0, mark)
          this.stack.push(list)
          break
        }
        case OP.EMPTY_TUPLE:
        case OP.EMPTY_LIST:
          this.stack.push([])
          break

        // ── Booleans ────────────────────────────────────────────────────────
        case OP.NEWTRUE:
          this.stack.push(true)
          break
        case OP.NEWFALSE:
          this.stack.push(false)
          break

        // ── Longs (big integers) – partially decoded ─────────────────────
        case OP.LONG1: {
          const length = buffer.readUInt8(i++)
          // FIXME: actually decode LONG1
          i += length
          this.stack.push(0)
          break
        }
        case OP.LONG4: {
          const length = buffer.readUInt32LE(i)
          i += 4
          // FIXME: actually decode LONG4
          i += length
          this.stack.push(0)
          break
        }

        // ── Stack manipulation ───────────────────────────────────────────────
        case OP.POP:
          this.stack.pop()
          break
        case OP.POP_MARK: {
          const mark = this.marker()
          this.stack = this.stack.slice(0, mark)
          break
        }
        case OP.DUP:
          this.stack.push(this.stack[this.stack.length - 1])
          break
        case OP.MARK:
          this.stack.push(this.MARK_TOKEN)
          break
        case OP.STOP:
          return this.stack.pop() ?? null

        // ── Dicts ───────────────────────────────────────────────────────────
        case OP.EMPTY_DICT:
          this.stack.push({} as Record<string, unknown>)
          break
        case OP.DICT: {
          const mark = this.marker()
          const obj: Record<string, unknown> = {}
          for (let pos = mark + 1; pos < this.stack.length; pos += 2) {
            obj[this.stack[pos] as string] = this.stack[pos + 1]
          }
          this.stack = this.stack.slice(0, mark)
          this.stack.push(obj)
          break
        }
        case OP.SETITEM: {
          const value = this.stack.pop()
          const key = this.stack.pop() as string
          ;(this.stack[this.stack.length - 1] as Record<string, unknown>)[key] =
            value
          break
        }
        case OP.SETITEMS: {
          const mark = this.marker()
          const obj = this.stack[mark - 1] as Record<string, unknown>
          for (let pos = mark + 1; pos < this.stack.length; pos += 2) {
            obj[this.stack[pos] as string] = this.stack[pos + 1]
          }
          this.stack = this.stack.slice(0, mark)
          break
        }

        // ── Lists ───────────────────────────────────────────────────────────
        case OP.APPEND: {
          const value = this.stack.pop()
          ;(this.stack[this.stack.length - 1] as unknown[]).push(value)
          break
        }
        case OP.APPENDS: {
          const mark = this.marker()
          const list = this.stack[mark - 1] as unknown[]
          list.push(...this.stack.slice(mark + 1))
          this.stack = this.stack.slice(0, mark)
          break
        }

        // ── Memo ────────────────────────────────────────────────────────────
        case OP.GET: {
          const line = buffer.readLine(i)
          i += line.length + 1
          this.stack.push(this.memo[line.toString()])
          break
        }
        case OP.BINGET: {
          const idx = buffer.readUInt8(i++)
          this.stack.push(this.memo[String(idx)])
          break
        }
        case OP.LONG_BINGET: {
          const idx = buffer.readUInt32LE(i)
          i += 4
          this.stack.push(this.memo[String(idx)])
          break
        }
        case OP.PUT: {
          const line = buffer.readLine(i)
          i += line.length + 1
          this.memo[line.toString()] = this.stack[this.stack.length - 1]
          break
        }
        case OP.BINPUT: {
          const idx = buffer.readUInt8(i++)
          this.memo[String(idx)] = this.stack[this.stack.length - 1]
          break
        }
        case OP.LONG_BINPUT: {
          const idx = buffer.readUInt32LE(i)
          i += 4
          this.memo[String(idx)] = this.stack[this.stack.length - 1]
          break
        }

        // ── Globals / callables ─────────────────────────────────────────────
        case OP.GLOBAL: {
          const module = buffer.readLine(i).toString()
          i += module.length + 1
          const name = buffer.readLine(i).toString()
          i += name.length + 1
          const key = `${module}.${name}`
          const func = this.emulated[key]
          if (func === undefined)
            throw new Error(`Cannot emulate global: ${module} ${name}`)
          this.stack.push(func)
          break
        }
        case OP.REDUCE: {
          const args = this.stack.pop() as unknown[]
          const func = this.stack[this.stack.length - 1] as EmulatedFn
          this.stack[this.stack.length - 1] = func(args)
          break
        }
        case OP.NEWOBJ: {
          // protocol 2: cls.__new__(cls, *args)
          const args = this.stack.pop() as unknown[]
          const cls = this.stack.pop() as new (...a: unknown[]) => unknown
          this.stack.push(new cls(...args))
          break
        }
        case OP.OBJ: {
          const cls = this.stack.pop() as new () => Record<string, unknown>
          const mark = this.marker()
          const obj = new cls()
          for (let pos = mark + 1; pos < this.stack.length; pos += 2) {
            obj[this.stack[pos] as string] = this.stack[pos + 1]
          }
          this.stack = this.stack.slice(0, mark)
          this.stack.push(obj)
          break
        }
        case OP.BUILD: {
          const dict = this.stack.pop() as Record<string, unknown>
          const obj = this.stack[this.stack.length - 1] as Record<
            string,
            unknown
          >
          Object.assign(obj, dict)
          break
        }

        // ── Integers ────────────────────────────────────────────────────────
        case OP.INT: {
          const line = buffer.readLine(i).toString()
          i += line.length + 1
          if (line === "01") this.stack.push(true)
          else if (line === "00") this.stack.push(false)
          else this.stack.push(parseInt(line, 10))
          break
        }
        case OP.BININT:
          this.stack.push(buffer.readInt32LE(i))
          i += 4
          break
        case OP.BININT1:
          try {
            this.stack.push(buffer.readUInt8(i))
          } catch {
            this.stack.push(0)
            logger.info(
              "Pickle Parser Out of sync. Please relaunch the monitor",
            )
            if (config.__loginfo__) {
              fs.writeFileSync(
                `${config.__log_path__}$BININT1${Date.now()}.txt`,
                buffer.toString("utf-8"),
                { encoding: "utf8" },
              )
            }
          }
          i += 1
          break
        case OP.BININT2:
          this.stack.push(buffer.readUInt16LE(i))
          i += 2
          break

        // ── Floats ──────────────────────────────────────────────────────────
        case OP.FLOAT: {
          const line = buffer.readLine(i).toString()
          i += line.length + 1
          this.stack.push(parseFloat(line))
          break
        }
        case OP.BINFLOAT:
          this.stack.push(buffer.readDoubleBE(i))
          i += 8
          break

        // ── Longs (text) ────────────────────────────────────────────────────
        case OP.LONG: {
          const line = buffer.readLine(i).toString()
          i += line.length + 1
          this.stack.push(parseInt(line, 10))
          break
        }

        // ── Strings ─────────────────────────────────────────────────────────
        case OP.STRING: {
          const line = buffer.readLine(i).toString()
          i += line.length + 1
          const first = line[0]
          const last = line[line.length - 1]
          if (
            (first === "'" && last === "'") ||
            (first === '"' && last === '"')
          ) {
            this.stack.push(line.slice(1, -1))
          } else {
            throw new Error("insecure string pickle")
          }
          break
        }
        case OP.UNICODE: {
          const line = buffer.readLine(i).toString()
          i += line.length + 1
          this.stack.push(line)
          break
        }
        case OP.BINSTRING: {
          const length = buffer.readUInt32LE(i)
          i += 4
          this.stack.push(buffer.toString("binary", i, i + length))
          i += length
          break
        }
        case OP.SHORT_BINSTRING: {
          const length = buffer.readUInt8(i++)
          this.stack.push(buffer.toString("binary", i, i + length))
          i += length
          break
        }
        case OP.BINUNICODE: {
          const length = buffer.readUInt32LE(i)
          i += 4
          this.stack.push(buffer.toString("utf8", i, i + length))
          i += length
          break
        }

        // ── Singletons ──────────────────────────────────────────────────────
        case OP.NONE:
          this.stack.push(null)
          break

        default:
          throw new Error(
            `Unhandled opcode '${opcode}' (0x${opcode.charCodeAt(0).toString(16)})`,
          )
      }
    }

    return null
  }
}
