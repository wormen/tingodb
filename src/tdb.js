import fs from 'fs';
import path from 'path';
import safe from 'safe';
import _ from 'lodash';
import {Buffer} from 'safe-buffer';
import {EventEmitter} from 'events';
import TColl from './tcoll';

let mstore = Object.create(null);

export default class TDB extends EventEmitter {
  constructor(path_, opts, gopts = {memStore: false}) {
    super();

    this._gopts = gopts;
    this._path = path.resolve(path_);
    this._cols = Object.create(null);
    this._name = opts.name || path.basename(path_);
    this._stype = gopts.memStore ? 'mem' : 'fs';
    if (this._stype === 'mem') {
      mstore[path_] = this._mstore = mstore[path_] || Object.create(null);
    }
    // mongodb compat variables
    this.openCalled = false;

    this.createIndex = _.rest((c, args) => {
      c = this._cols[c];

      if (!c) {
        return safe.back(args[args.length - 1], new Error("Collection doesn't exists"));
      }

      c.createIndex.apply(c, args);
    });
  }

  init(path, options, cb) {
    this._path = path;
    cb(null);
  }

  open(options, cb) {
    // actually do nothing for now, we are inproc
    // so nothing to open/close... collection will keep going on their own
    if (cb == null) {
      cb = options;
    }
    cb = cb || function () {
    };
    this.openCalled = true;
    safe.back(cb, null, this);
  }

  close(forceClose, cb) {
    if (cb == null) {
      cb = forceClose;
    }

    cb = cb || function () {
    };

    // stop any further operations on current collections
    safe.eachOf(this._cols, (c, k, cb) => {
      c._stop(cb);
    }, safe.sure(cb, () => {
      // and clean list
      this._cols = Object.create(null);
      this.openCalled = false;
      safe.back(cb, null, this);
    }));
  }

  collection(cname, opts, cb) {
    return this._collection(cname, opts, false, cb);
  }

  createCollection(cname, opts, cb) {
    return this._collection(cname, opts, true, cb);
  }

  _nameCheck(cname) {
    let err = null;
    if (!_.isString(cname)) {
      err = new Error("collection name must be a String");
    }

    if (!err && cname.length === 0) {
      err = new Error("collection names cannot be empty");
    }

    if (!err && cname.includes("$")) {
      err = new Error("collection names must not contain '$'");
    }
    if (!err) {
      let di = cname.indexOf(".");
      if (di === 0 || di === cname.length - 1)
        err = new Error("collection names must not start or end with '.'");
    }

    if (!err && cname.indexOf("..") != -1) {
      err = new Error("collection names cannot be empty");
    }
    return err;
  }

  _collection(cname, opts, create, cb) {
    let err = this._nameCheck(cname);

    if (!cb) {
      cb = opts;
      opts = {};
    }

    cb = cb || function () {
    };

    if (err) {
      return safe.back(cb, err);
    }

    let c = this._cols[cname];
    if (c) {
      if (opts.strict && create) {
        safe.back(cb, new Error(`Collection ${cname} already exists. Currently in safe mode.`));
      } else {
        safe.back(cb, null, c);
      }
      return c;
    }

    c = new TColl(this);
    this._cols[cname] = c;

    c.init(this, cname, opts, create, (err) => {
      if (err) {
        delete this._cols[cname];
        cb(err);
      } else {
        cb(null, c);
      }
    });

    return c;
  }

  collectionNames(opts, cb) {
    if (_.isUndefined(cb)) {
      cb = opts;
      opts = {};
    }

    if (this._stype === 'mem') {
      cb(null, _.map(this._mstore, (v, e) => {
        return opts.namesOnly ? e : {name: [this._name, e].join('.')};
      }));
    } else {
      fs.readdir(this._path, safe.sure(cb, (files) => {
        // some collections ca be on disk and some only in memory, we need both
        files = _(this._cols).keys().union(files);
        cb(null, files.reject(e => {
          return /^\./.test(e);
        }) // ignore hidden linux alike files
          .map(e => {
            return opts.namesOnly ? e : {name: [this._name, e].join('.')};
          })
          .value());
      }));
    }
  }

  collections(cb) {
    this.collectionNames({namesOnly: 1}, safe.sure(cb, (names) => {
      safe.forEach(names, (cname, cb) => {
        this.collection(cname, cb);
      }, safe.sure(cb, () => {
        cb(null, _.values(this._cols));
      }));
    }));
  }

  dropCollection(cname, cb) {
    let c = this._cols[cname];
    if (!c) {
      let err = new Error("ns not found");
      if (cb) {
        return safe.back(cb, err);
      }
      throw new err;
    }

    c._stop(safe.sure(cb, (ondisk) => {
      delete this._cols[cname];
      if (ondisk) {
        fs.unlink(path.join(this._path, cname), safe.sure(cb, function () {
          cb(null, true);
        }));
      } else {
        if (this._stype === 'mem') {
          delete this._mstore[cname];
        }
        cb(null, true);
      }
    }));
  }

  dropDatabase(cb) {
    this.collections(safe.sure(cb, (collections) => {
      safe.forEach(collections, (c, cb) => {
        this.dropCollection(c.collectionName, cb);
      }, cb);
    }));
  }

  compactDatabase(cb) {
    this.collections(safe.sure(cb, function (collections) {
      safe.forEach(collections, function (c, cb) {
        c.compactCollection(cb);
      }, cb);
    }));
  }

  renameCollection(on, nn, opts, cb) {
    if (cb == null) {
      cb = opts;
      opts = {};
    }

    cb = cb || safe.noop;
    let old = this._cols[on];

    if (old) {
      old.rename(nn, {}, cb);
    } else {
      safe.back(cb);
    }
  }

  _cloneDeep(obj) {
    return _.cloneDeepWith(obj, (c) => {
      if (c instanceof this.ObjectID) {
        return new c.constructor(c.toString());
      }
      if (c instanceof this.Binary) {
        return new c.constructor(new Buffer(c.value(true)));
      }
    });
  }
}
