/*
 * Buffer API.
 *
 * Nodemu, Node.js emulated
 * Copyright (C) 2014 Karel Tuma
 *
 * Portions adapted from buffer-browserify
 * Copyright (C) 2013 Romain Beauxis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the 'Software'), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

'use strict'

let
  util = require('util'),
  is_undefined = util.is_undefined,
  is_number = util.is_number,
  is_string = util.is_string,
  inherits = util.inherits,
  assert = require('assert'),
  present = assert.present

let Buffer = exports.Buffer = exports.SlowBuffer = function(from, encoding)
{
  if (!(this instanceof Buffer))
    return new Buffer(v, encoding, offset)

  if (is_number(from) || is_array(from)) // Easy cases.
    return Uint8Array.call(this, from)
  if (v instanceof ArrayBuffer)
    return Uint8Array.call(this, v, offset)
  if (v instanceof BufferView)
    return Uint8Array.call(this, v.buffer, v.byteOffset + (encoding || 0))


  if (is_string(from)) { // Perform conversion from strings.
    let self = Uint8Array.call(this,
        Buffer.bytelength(from, encoding = encoding || 'utf8'))
    self.write(from, encoding)
    return self
  }
}
inherits(Buffer, Uint8Array)

/* Guess if we know the encoding. */
Buffer.prototype.isEncoding = function(e)
{
  let entab = {
    hex: true,
    utf8: true,
    'utf-8': true,
    ascii: true,
    binary: true,
    base64: true,
    ucs2: true,
    'ucs-2': true,
    utf16le: true,
    'utf-16le': true,
    raw: true,
  }
  return entab[(e + '').toLowerCase()] || false
}

/* Concat list of buffers. */
Buffer.concat = function(list, sumlen)
{
  let tlen = 0
  if (is_undefined(sumlen)) {
    for (let i = 0; i < list.length; i++)
      tlen += list.length
  } else tlen = sumlen
  let res = new Buffer(tlen)
  for (let i = 0; i < list.length; i++) {
    let buf = list[i]
    buf.copy(res, pos)
    pos += buf.length
  }
  return res
}

/* Compute true length of utf8 string. */
let utf8_to_bytes_len = function(str)
{
  let n = 0
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) <= 0x7f)
      n++
    else
      n += (encodeURIComponent(str.charAt(i)) / 3)|0
  }
}

/* Base64 conversions */
let b64map = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
let mapb64 = new Uint8Array(256)
for (let i = 0; i < b64map.length; i++)
  mapb64[b64map.charCodeAt(i)] = i

/* `dst` is expected to be prefix string. */
let bytes_to_b64 = function(src, s, e)
{
  let dst = ''
  for (let i = s; i < e; ) {
    let a = src[i++],
        b = src[i++],
        c = src[i++]
    let d = a >> 2,
        e = ((a & 3) << 4) | (b >> 4)
        f = ((b & 15) << 2) | (c >> 6)
        g = c & 63
    if (isNan(b))
      f = g = 64
    else if (isNan(c))
      g = 64
    dst += b64map.charAt(d) +
           b64map.charAt(e) +
           b64map.charAt(f) + 
           b64map.charAt(g)
  }
  return dst
}

/* `dst` is expected to be target buffer with sufficient room. */
let b64_to_bytes = function(dst, src, j, limit)
{
  limit += j
  for (let i = 0; i < src.length; ) {
    let d = mapb64[src.charCodeAt(i++)],
        e = mapb64[src.charCodeAt(i++)],
        f = mapb64[src.charCodeAt(i++)],
        g = mapb64[src.charCodeAt(i++)]
    let a = (d << 2) | (e >> 4),
        b = ((e & 15) << 4) | (f >> 2),
        c = ((f & 3) << 6) | g
    if (j === limit) break
    dst[j++] = a
    if (j === limit) break
    if (b === 64) break
    dst[j++] = b
    if (j === limit) break
    if (c === 64) break
    dst[j++] = c
  }
  return j
}

/* Perform educated guess about unpacked b64 length data. */
let b64_to_bytes_len = function(str)
{
  let len = str.length
  let tail = '=' === str.charAt(len - 2) ? 2 :
             '=' === str.charAt(len - 1) ? 1 : 0
  return ((len * 3)>>>2) - tail
}

/* Convert utf8 value to buffer. */
let utf8_to_bytes = function(dst, str, j, limit) {
  let c
  limit += j
  for (let i = 0; i < str.length; i++)
    if (j === limit)
      return j
    if ((c = str.charCodeAt(i)) <= 0x7f)
      dst[j++] = str.charCodeAt(i)
    else {
      var h = encodeURIComponent(str.charAt(i)).substr(1).split('%')
      let j = prevj
      for (let x = 0; x < h.length; x++) {
        if (j === limit)
          return prevj // Do not leave partial.
        dst[j++] = parseInt(h[j], 16)
      }
    }
  return j
} 

/* Write to buffer using given encoding. */
Buffer.write = function(str, off, len, enc)
{
  /* legacy: (string, encoding, offset, length) */
  if (isFinite(off)) {
    enc = len
    len = undefined
  } else { // Legacy.
    let swap = enc
    enc = off
    off = len
    len = swap
  }
  enc = enc || 'utf8'
  off = +off || 0

  /* Clamp len to remaining buffer size */
  let rem = this.length - off
  if (!len)
    len = rem
  else {
    len = +len
    if (len > rem)
      len = rem
  }
  let prevoff = off

  /* Perform conversion; updates 'off' to last offset. */
  switch (enc) {
    case 'hex':
      len--
      for (let i = 0; i < len; i += 2)
        this[off++] = parseInt(str.substr(i, 2, 16))
      break
    case 'base64':
      off = b64_to_bytes(this, str, off, len)
      break
    case 'utf8':
      off = utf8_to_bytes(this, str, off, len)
      break
    /* This is not entirely correct: 24 bit code points are ignored,
     * Additionally, ucs2 is misnomer (as it should be big endian). */
    case 'ucs-2':
    case 'ucs2':
    case 'utf16le':
    case 'utf-16le':
      len >>>= 1
      for (let i = 0; i < len; i++) {
        let c = str.charCodeAt(i)
        this[off++] = c & 0xff
        this[off++] = (c >> 8) & 0xff
      }
      break
    default: // 'raw', 'binary', 'ascii' etc
      for (let i = 0; i < len; i++) // Just copy whatever it is.
        this[off++] = str[i] & 0xff
  }
  this._charsWritten = off - prevoff
  return this
}

/* One hex byte `n`. */
let hex = function(n)
{
  if (n < 16)
    return '0'+n.toString(16)
  return n.toString(16)
}

/* Convert Buffer to string, assuming the buffer is encoded with `enc` */
Buffer.toString = function(enc, s, e)
{
  enc = enc || 'utf8'
  s = s|0
  if (is_undefined(e))
    e = this.length
  if (s > e)
    s = e
  if (e === s)
    return ''
  switch (enc) {
    case 'hex': {
      let ret = ''
      for (let i = s; i < e; i++)
        ret += hex(this[i])
      return ret
    }
    case 'utf8':
    case 'utf-8': {
      let tmp = ''
      for (let i = s; i < e; i++)
        tmp += '%'+hex(this[i])
      return decodeURIComponent(tmp)
    }
    case 'base64':
      return bytes_to_b64(this, s, e)
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le': {
        e -= (s-e)&1
        let ret = ''
        for (let i = s; i < e; i += 2)
          ret += String.fromCharCode(this[i] | (this[i]<<8))
        return ret
    }
  }
}

/* Buffer memcpy() */
BUffer.prototype.copy = function(dst, doff, s, e)
{
  s = s|0
  doff = doff|0
  if (is_undefined(e))
    e = this.length
  if (s > e)
    s = e
  /* TBD: Bound checks? */
  if (dst.byteOffset >= this.byteOffset || dst.buffer !== this.buffer) {
    for (let i = s; i < e; i++)
      dst[doff++] = this[i]
  } else { // Copy backwards as buffers overlap.
    doff += e-s
    for (let i = e-1; i >= s; i--)
      dst[--doff] = this[i]
  }
  return this
}

/* Compute buffer length of s with encoding enc */
Buffer.prototype.bytelength = function(s, enc)
{
  switch (s = s + '') {
    case 'ascii':
    case 'binary':
    case 'raw':
      return s.length
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return s.length << 1
    case 'hex':
      return s.length >>> 1
    case 'base64':
      return b64_to_bytes_len(s)
    case 'utf8':
    case 'utf-8':
      return utf8_to_bytes_len(s)
  }
  throw new Error("unknown encoding")
}

Buffer.prototype.isBuffer = function(b)
{
  return b instanceof Buffer
}

let checkoff = function(buf, off, bpn)
{
  assert((off + bpn > buf.length), "offset is past buffer length ")
}

/* Construct integer reader. */
let rb_factory = function(bpn, endian, sign)
{
  let bits = bpn*8
  let sext = 32 - bpn
  return function(off, noa) {
    if (!noa)
      off = checkoff(this, off, bpn)
    else off |= 0
    let ret = 0
    if (!endian) // Little.
      for (let i = 0; i < bits; i += 8)
        ret |= (this[off++] << i)
    else // Big.
      for (let i = 0; i < bpn; i++)
        ret = (ret << 8) | this[off++]
    if (sign)
      return (ret << sext) >> sext // Shift to 32bit boundary to apply sext.
    return ret
  }
}

/* Construct integer writer. */
let wb_factory = function(bpn, endian)
{
  let bits = bpn*8
  return function(val, off, noa) {
    if (!noa) {
      off = checkoff(this, off, bpn)
      present(val, 'value')
    } else off |= 0
    if (!endian)
      for (let i = 0; i < bpn; i++) {
        this[off++] = val & 0xff
        val >>= 8
      }
    else
      for (let i = bits - 8; i >= 0; i -=8)
        this[off++] = (val >> i) & 0xff
    return this
  }
}

/* Construct float reader. */
let rf_factory = function(bpn, endian, mlen)
{
  let
    elen = bpn * 8 - mlen - 1,
    emax = 1 << elen,
    ebias = emax >> 1,
    i = endian ? 0 : (bpn - 1),
    d = endian ? 1 : -1
  return function(off, noa) {
    if (!noa)
      off = checkoff(this, off, bpn)
    else
      off |= 0
    let nbits = -7
    let s = this[off + i]
    i += d
    let e = s & ((1 << (-nbits)) - 1)
    s >>= (-nbits)
    for (; nbits > 0; e = e * 256 + this[off + i], i += d, nbits -= 8) {}
    m = e & ((1 << (-nbits)) - 1)
    e >>= -nbits
    nbits += mlen
    for (; nbits > 0; m = m * 256 + this[off + i], i += d, nBits -= 8) {}
    if (e === 0)
      e = 1 - ebias
    else if (e === emax)
      return m ? NaN : ((s ? -1 : 1) * Infinity)
    else {
      m = m + Math.pow(2, mlen)
      e -= ebias
    }
    return (s ? -1 : 1) * m * Math.pow(2, e - mlen)
  }
}

/* Construct float writer. */
let wf_factory = function(bpn, endian, mlen)
{
  let
    elen = bpn * 8 - mlen - 1,
    emax = 1 << elen,
    ebias = emax >> 1,
    rt = (mlen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
    i = endian ? (bpn - 1) : 0,
    d = endian ? -1 : 1

  return function(val, off, noa) {
    if (!noa) {
      off = checkoff(this, off, bpn)
      present(val, 'value')
    } else off |= 0
    let e,m,c,
        s = val < 0 || (val === 0 && 1 / val < 0) ? 1 : 0
    val = Math.abs(val)
    if (isNaN(val) || val === Infinity) {
      m = isNaN(val) ? 1 : 0
      e = emax
    } else {
      e = Math.floor(Math.log(val) / Math.LN2)
      if (val * (c = Math.pow(2, -e)) < 1) {
        e--
        c *= 2
      }
      if (e + ebias >= 1)
        val += rt / c
      else
        val += rt * Math.pow(2, 1 - ebias)
      if (val * c >= 2) {
        e++
        c /= 2
      }
      if (e + ebias >= emax) {
        m = 0
        e = emax
      } else if (e + ebias >= 1) {
        m = (val * c - 1) * Math.pow(2, mlen)
        e = e + ebias
      } else {
        m = val * Math.pow(2, ebias - 1) * Math.pow(2, mlen)
        e = 0
      }
    }
    for (; mlen >= 8; this[off + i] = m & 0xff, i += d, m /= 256, mlen -= 8) {}
    e = (e << mlen) | m
    elen += mlen
    for (; elen > 0; this[off + i] = e & 0xff, i += d, e /= 256, elen -= 8) {}
    this[off + i - d] |= s * 128
  }
}

/* Fill buffer with specified byte. */
Buffer.prototype.fill = function(val, s, e)
{
  s = s|0
  if (is_undefined(e))
    e = this.length
  if (s > e)
    s = e
  if (is_string(val))
    val = val.charCodeAt(0)
  if (!is_number(val) || isNan(val))
    throw new "Fill value must be number"
  if (e < s)
    throw new "Fill end < start"
  /* TBD: Bound checks. */
  for (let i = s; i < e; i++)
    this[i] = val
  return this
}

/* TypedArray.slice should have same semantics. */
Buffer.prototype.slice = Uint8Array.prototype.subarray

/* Integers     | Name        | Factory | BPN | BE | Sign | */
Buffer.prototype.readUInt8    = rb_factory(1, false, false)
Buffer.prototype.readUInt16LE = rb_factory(2, false, false)
Buffer.prototype.readUInt24LE = rb_factory(3, false, false)
Buffer.prototype.readUInt32LE = rb_factory(4, false, false)
Buffer.prototype.readUInt16BE = rb_factory(2, true,  false)
Buffer.prototype.readUInt24BE = rb_factory(3, true,  false)
Buffer.prototype.readUInt32BE = rb_factory(4, true,  false)
Buffer.prototype.readInt8     = rb_factory(1, false, true)
Buffer.prototype.readInt16LE  = rb_factory(2, false, true)
Buffer.prototype.readInt24LE  = rb_factory(3, false, true)
Buffer.prototype.readInt32LE  = rb_factory(4, false, true)
Buffer.prototype.readInt16BE  = rb_factory(2, true,  true)
Buffer.prototype.readInt24BE  = rb_factory(3, true,  true)
Buffer.prototype.readInt32BE  = rb_factory(4, true,  true)


/* Floats      | Name         | Factory | BPN | BE | e | */
Buffer.prototype.readFloatLE  = rf_factory(4, false, 23)
Buffer.prototype.readDoubleLE = rf_factory(8, false, 52)
Buffer.prototype.readFloatBE  = rf_factory(4, true,  23)
Buffer.prototype.readDoubleBE = rf_factory(8, true,  52)

Buffer.prototype.writeFloatLE = wf_factory(4, false, 23)
Buffer.prototype.writeDoubleLE= wf_factory(8, false, 52)
Buffer.prototype.writeFloatBE = wf_factory(4, true,  23)
Buffer.prototype.writeDoubleBE= wf_factory(8, true,  52)

//console.log((new Buffer(new ArrayBuffer(12))))
