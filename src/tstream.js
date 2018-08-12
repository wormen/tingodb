import safe from 'safe';
import _ from 'lodash';

/**
 * Module dependecies.
 */
import {Stream} from 'stream';

/**
 * CursorStream
 *
 * Returns a stream interface for the **cursor**.
 *
 * Options
 *  - **transform** {Function} function of type function(object) { return transformed }, allows for transformation of data before emitting.
 *
 * Events
 *  - **data** {function(item) {}} the data event triggers when a document is ready.
 *  - **error** {function(err) {}} the error event triggers if an error happens.
 *  - **close** {function() {}} the end event triggers when there is no more documents available.
 *
 * @class Represents a CursorStream.
 * @param {Cursor} cursor a cursor object that the stream wraps.
 * @return {Stream}
 */
export default class CursorStream extends Stream {
  constructor(cursor, options = {}) {
    super();

    if (!(this instanceof CursorStream)) return new CursorStream(cursor);

    this.readable = true; // Flag stating whether or not this stream is readable.
    this.paused = false; // Flag stating whether or not this stream is paused.
    this._cursor = cursor;
    this._destroyed = null;
    this.options = options;

    // give time to hook up events
    safe.back(() => {
      this._init();
    });
  }

  /**
   * Initialize the cursor.
   * @ignore
   * @api private
   */
  _init() {
    if (this._destroyed) {
      return;
    }
    this._next();
  }

  /**
   * Pull the next document from the cursor.
   * @ignore
   * @api private
   */
  _next() {
    if (this.paused || this._destroyed) {
      return;
    }

    // Get the next object
    safe.back(() => {
      if (this.paused || this._destroyed) {
        return;
      }

      this._cursor.nextObject((err, doc) => {
        this._onNextObject(err, doc);
      });
    });
  }

  /**
   * Handle each document as its returned from the cursor.
   * @ignore
   * @api private
   */
  _onNextObject(err, doc) {
    if (err) {
      return this.destroy(err);
    }

    // when doc is null we hit the end of the cursor
    //if(!doc && (this._cursor.state == 1 || this._cursor.state == 2)) {
    if (!doc) {
      this.emit('end');
      return this.destroy();
    } else if (doc) {
      let data = _.isFunction(this.options.transform) ? this.options.transform(doc) : doc;
      this.emit('data', data);
      this._next();
    }
  }

  /**
   * Pauses the stream.
   *
   * @api public
   */
  pause() {
    this.paused = true;
  }

  /**
   * Resumes the stream.
   *
   * @api public
   */
  resume() {
    // Don't do anything if we are not paused
    if (!this.paused) {
      return;
    }

    //if(!this._cursor.state == 3) return;

    this.back(() => {
      this.paused = false;
      // Only trigger more fetching if the cursor is open
      this._next();
    });
  }

  /**
   * Destroys the stream, closing the underlying
   * cursor. No more events will be emitted.
   *
   * @api public
   */
  destroy(err) {
    if (this._destroyed){
      return;
    }
    this._destroyed = true;
    this.readable = false;

    this._cursor.close();

    if (err) {
      this.emit('error', err);
    }

    this.emit('close');
  }
}

// TODO - maybe implement the raw option to pass binary?
//CursorStream.prototype.setEncoding = function () {
//}

