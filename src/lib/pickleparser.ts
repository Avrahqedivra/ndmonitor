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
 *  Based on the work of Jeremy Lainé on github https://www.npmjs.com/package/jpickle
 *  Copyright(c) 2023-24 F4JDN - Jean-Michel Cohen
 *  
*/
import fs from "fs"
import { logger } from "../monitor.js"
import * as config from '../config.js'

export class PickleParser {
  private mark = 'THIS-NEEDS-TO-BE-UNIQUE-TO-SERVE-AS-A-BOUNDARY';
  private memo = {};
  private stack = [];

  private emulated = {
    'datetime.datetime': function(args) {
        var tmp = Buffer.from(args[0], 'binary')
          , year = tmp.readUInt16BE(0)
          , month = tmp.readUInt8(2) - 1
          , day = tmp.readUInt8(3)
          , hour = tmp.readUInt8(4)
          , minute = tmp.readUInt8(5)
          , second = tmp.readUInt8(6)
          , microsecond = tmp.readUInt32BE(6) & 0xffffff

        if (args[1] == 'UTC') {
            return new Date(Date.UTC(year, month, day, hour, minute, second, microsecond / 1000))
        } else {
            return new Date(year, month, day, hour, minute, second, microsecond / 1000)
        }
    },
    '_codecs.encode': function(args) {
        return args[0]
    },
    '__builtin__.bytes': function(args) {
        return args[0]
    },
    'collections.deque': function (iterable, maxlen) {
        return iterable
    }
  }

  constructor() {
  }

  reSync(): void {
    this.mark = 'THIS-NEEDS-TO-BE-UNIQUE-TO-SERVE-AS-A-BOUNDARY'
    this.memo = {}
    this.stack = []
  }

  marker() {
    var k = this.stack.length - 1
    
    while (k > 0 && this.stack[k] !== this.mark)
        --k;
    
    return k;
  }

  load(pickle: any) {
    let MARK = '('              // push special markobject on stack
      , STOP = '.'              // every pickle ends with STOP
      , POP = '\x00'            // discard topmost stack item
      , POP_MARK = '\x01'       // discard stack top through topmost markobject
      , DUP = '\x02'            // duplicate top stack item
      , FLOAT = 'F'             // push float object; decimal string argument
      , INT = 'I'               // push integer or bool; decimal string argument
      , BININT = 'J'            // push 4-byte signed int
      , BININT1 = 'K'           // push 1-byte unsigned int
      , LONG = 'L'              // push long; decimal string argument
      , BININT2 = 'M'           // push 2-byte unsigned int
      , NONE = 'N'              // push None
    //   , PERSID = "O"
    //   , BINPERSID = "P"
      , REDUCE = 'R'            // apply callable to argtuple, both on stack
      , STRING = 'S'            // push string; NL-terminated string argument
      , BINSTRING = 'T'         // push string; counted binary string argument
      , SHORT_BINSTRING = 'U'   //  "     "   ;    "      "       "      " < 256 bytes
      , UNICODE = 'V'           // push Unicode string; raw-unicode-escaped'd argument
      , BINUNICODE = 'X'        //   "     "       "  ; counted UTF-8 string argument
      , APPEND = 'a'            // append stack top to list below it
      , BUILD = 'b'             // build the entire value
      , GLOBAL = 'c'            // push self.find_class(modname, name); 2 string args
      , DICT = 'd'              // build a dict from stack items
      , EMPTY_DICT = '}'        // push empty dict
      , APPENDS = 'e'           // extend list on stack by topmost stack slice
      , GET = 'g'               // push item from memo on stack; index is string arg
      , BINGET = 'h'            //   "    "    "    "   "   "  ;   "    " 1-byte arg
      // missing INST
      , LONG_BINGET = 'j'       // push item from memo on stack; index is 4-byte arg
      , LIST = 'l'              // build list from topmost stack items
      , EMPTY_LIST = ']'        // push empty list
      , OBJ = 'o'               // build a class instance using the objects between here and the mark
      , PUT = 'p'               // store stack top in memo; index is string arg
      , BINPUT = 'q'            //   "     "    "   "   " ;   "    " 1-byte arg
      , LONG_BINPUT = 'r'       //   "     "    "   "   " ;   "    " 4-byte arg
      , SETITEM = 's'           // add key+value pair to dict
      , TUPLE = 't'             // build tuple from topmost stack items
      , EMPTY_TUPLE = ')'       // push empty tuple
      , SETITEMS = 'u'          // modify dict by adding topmost key+value pairs
      , BINFLOAT = 'G'          // push float; arg is 8-byte float encoding
      // protocol 2
      , PROTO = '\x80'          // identify pickle protocol
      , NEWOBJ = '\x81'         // build object by applying cls.__new__ to argtuple
      , TUPLE1 = '\x85'         // build 1-tuple from stack top
      , TUPLE2 = '\x86'         // build 2-tuple from two topmost stack items
      , TUPLE3 = '\x87'         // build 3-tuple from three topmost stack items
      , NEWTRUE = '\x88'        // push True
      , NEWFALSE = '\x89'       // push False
      , LONG1 = '\x8a'          // push long from < 256 bytes
      , LONG4 = '\x8b'          // push really big long

    let buffer = Buffer.from(pickle, 'binary')

    buffer["readLine"] = (i: number) => {
      var index = buffer.indexOf('\n', i)
      if (index == -1)
          throw "Could not find end of line"

      return buffer.subarray(i, index)
    }

    for (var i = 0; i < buffer.length; ) {
      var opindex = i, opcode = buffer[i++];

      switch (String.fromCharCode(opcode)) {
        // protocol 2
        case PROTO:
            var proto = buffer.readUInt8(i++);
            if (proto != 2)
                throw 'Unhandled pickle protocol version: ' + proto;
            break;
        case TUPLE1:
            var a = this.stack.pop();
            this.stack.push([a]);
            break;
        case TUPLE2:
            var b = this.stack.pop()
              , a = this.stack.pop();
            this.stack.push([a, b]);
            break;
        case TUPLE3:
            var c = this.stack.pop()
              , b = this.stack.pop()
              , a = this.stack.pop();
            this.stack.push([a, b, c]);
            break;
        case NEWTRUE:
            this.stack.push(true);
            break;
        case NEWFALSE:
            this.stack.push(false);
            break;
        case LONG1:
            var length = buffer.readUInt8(i++);
            // FIXME: actually decode LONG1
            i += length;
            this.stack.push(0);
            break;
        case LONG4:
            var length = buffer.readUInt32LE(i);
            i += 4;
            // FIXME: actually decode LONG4
            i += length;
            this.stack.push(0);
            break;
        // protocol 0 and protocol 1
        case POP:
            this.stack.pop();
            break;
        case POP_MARK:
            var mark = this.marker();
            this.stack = this.stack.slice(0, mark);
            break;
        case DUP:
            var value = this.stack[this.stack.length-1];
            this.stack.push(value);
            break;
        case EMPTY_DICT:
            this.stack.push({});
            break;
        case EMPTY_LIST:
        case EMPTY_TUPLE:
            this.stack.push([]);
            break;
        case GET:
            var index = buffer["readLine"](i);
            i += index.length + 1;
            this.stack.push(this.memo[index]);
            break;
        case BINGET:
            var index = buffer.readUInt8(i++);
            this.stack.push(this.memo[''+index]);
            break;
        case LONG_BINGET:
            var index = buffer.readUInt32LE(i);
            i+=4;
            this.stack.push(this.memo[''+index]);
            break;
        case PUT:
            var index = buffer["readLine"](i);
            i += index.length + 1;
            this.memo[index] = this.stack[this.stack.length-1];
            break;
        case BINPUT:
            var index = buffer.readUInt8(i++);
            this.memo['' + index] = this.stack[this.stack.length-1];
            break;
        case LONG_BINPUT:
            var index = buffer.readUInt32LE(i);
            i += 4;
            this.memo['' + index] = this.stack[this.stack.length-1];
            break;
        case GLOBAL:
            var module = String.fromCharCode.apply(null, buffer["readLine"](i));
            i += module.length + 1;
            var name = String.fromCharCode.apply(null, buffer["readLine"](i));
            i += name.length + 1;
            var func = this.emulated[module + '.' + name];

            // console.log(module + '.' + name)

            if (func === undefined)
                throw "Cannot emulate global: " + module + " " + name;

            this.stack.push(func);
            break;
        case OBJ:
            var obj = new (this.stack.pop())();
            var mark = this.marker();
            for (var pos = mark + 1; pos < this.stack.length; pos += 2) {
              obj[this.stack[pos]] = this.stack[pos + 1];
            }
            this.stack = this.stack.slice(0, mark);
            this.stack.push(obj);
            break;
        case BUILD:
            var dict = this.stack.pop();
            var obj = this.stack.pop();
            for ( var p in dict ) {
              obj[p] = dict[p];
            }
            this.stack.push(obj);
            break;
        case REDUCE:
            var args = this.stack.pop();
            var func = this.stack[this.stack.length - 1];
            this.stack[this.stack.length - 1] = func(args);
            break;
        case INT:
            var value = buffer["readLine"](i);
            i += value.length + 1;
            if (value == '01')
                this.stack.push(true);
            else 
            if (value == '00')
                this.stack.push(false);
            else
                this.stack.push(parseInt(value));
            break;
        case BININT:
            this.stack.push(buffer.readInt32LE(i));
            i += 4;
            break;
        case BININT1:
            try {
                this.stack.push(buffer.readUInt8(i));
            }
            catch(e) {
                this.stack.push(0);
                logger.info('Pickle Parser Out of sync. Please relaunch the monitor')

                if (config.__loginfo__) {
                    fs.writeFileSync(`${config.__log_path__}$BININT1${Date.now()}.txt`, buffer.toString('utf-8'), { encoding: 'utf8' })
                }
            }

            i += 1;
            break;
        case BININT2:
            this.stack.push(buffer.readUInt16LE(i));
            i += 2;
            break;
        case MARK:
            this.stack.push(this.mark);
            break;
        case FLOAT:
            var value = buffer["readLine"](i);
            i += value.length + 1;
            this.stack.push(parseFloat(value));
            break;
        case LONG:
            var value = buffer["readLine"](i);
            i += value.length + 1;
            this.stack.push(parseInt(value));            
            break;
        case BINFLOAT:
            this.stack.push(buffer.readDoubleBE(i));
            i += 8;
            break;
        case STRING:
            var value = buffer["readLine"](i);
            i += value.length + 1;
            var quotes = "\"'";
            if (value[0] == "'") {
                if (value[value.length-1] != "'")
                    throw "insecure string pickle";
            } else if (value[0] = '"') {
                if (value[value.length-1] != '"')
                    throw "insecure string pickle";
            } else {
                throw "insecure string pickle";
            }
            this.stack.push(value.substr(1, value.length-2));
            break;
        case UNICODE:
            var value = buffer["readLine"](i);
            i += value.length + 1;
            this.stack.push(value);
            break;
        case BINSTRING:
            var length = buffer.readUInt32LE(i);
            i += 4;
            this.stack.push(buffer.toString('binary', i, i + length));
            i += length;
            break;
        case SHORT_BINSTRING:
            var length = buffer.readUInt8(i++);
            this.stack.push(buffer.toString('binary', i, i + length));
            i += length;
            break;
        case BINUNICODE:
            var length = buffer.readUInt32LE(i);
            i += 4;
            this.stack.push(buffer.toString("utf8", i, i + length));
            i += length;
            break;
        case APPEND:
            var value = this.stack.pop();
            this.stack[this.stack.length-1].push(value);
            break;
        case APPENDS:
            var mark = this.marker(), list = this.stack[mark - 1];
            list.push.apply(list, this.stack.slice(mark + 1));
            this.stack = this.stack.slice(0, mark);
            break;
        case SETITEM:
            var value = this.stack.pop(), key = this.stack.pop();
            this.stack[this.stack.length-1][key] = value;
            break;
        case SETITEMS:
            var mark = this.marker(), obj = this.stack[mark - 1];
            for (var pos = mark + 1; pos < this.stack.length; pos += 2)
                obj[this.stack[pos]] = this.stack[pos + 1];

            this.stack = this.stack.slice(0, mark);
            break;
        case LIST:
        case TUPLE:
            var mark = this.marker(), list:any = this.stack.slice(mark + 1);
            this.stack = this.stack.slice(0, mark);
            this.stack.push(list);
            break;
        case DICT:
            var mark = this.marker()
                obj = {};
            for (var pos = mark + 1; pos < this.stack.length; pos += 2) {
                obj[this.stack[pos]] = this.stack[pos + 1];
            }
            this.stack = this.stack.slice(0, mark);
            this.stack.push(obj);
            break;
        case STOP:
            return this.stack.pop();
        case NONE:
            this.stack.push(null);
            break;
        default:
            throw "Unhandled opcode '" + opcode + "'";
      }
    }
  }
}

