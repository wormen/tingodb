import safe from 'safe';
import _ from 'lodash';
import CursorStream from './tstream';

export default class TCursor {
  constructor(tcoll, query, fields, opts) {
    this.INIT = 0;
    this.OPEN = 1;
    this.CLOSED = 2;
    this.GET_MORE = 3;
    this._query = query;
    this._c = tcoll;
    this._i = 0;
    this._skip = 0;
    this._limit = null;
    this._count = null;
    this._items = null;
    this._sort = null;
    this._hint = opts.hint;
    this._arFields = Object.create(null);
    this._fieldsType = null;
    this._fieldsExcludeId = false;
    this._fields = Object.create(null);
    this.timeout = _.isUndefined(opts.timeout) ? true : opts.timeout;

    _.each(fields, (v, k) => {
      if (!k && _.isString(v)) {
        k = v;
        v = 1;
      }
      if (v === 0 || v === 1) {
        // _id treated specially
        if (k === "_id" && v === 0) {
          this._fieldsExcludeId = true;
          return;
        }

        if (_.isNull(this._fieldsType)) {
          this._fieldsType = v;
        }

        if (this._fieldsType === v) {
          if (k.includes("_tiar.")) {
            this._arFields[k.substr(6)] = 1;
          } else {
            this._fields[k] = v;
          }
        } else if (!this._err) {
          this._err = new Error("Mixed set of projection options (0,1) is not valid");
        }
      } else if (!this._err) {
        this._err = new Error("Unsupported projection option: " + JSON.stringify(v));
      }
    });

    // _id treated specially
    if ((this._fieldsType === 0 || _.isNull(this._fieldsType)) && this._fieldsExcludeId) {
      this._fieldsType = 0;
      this._fields['_id'] = 0;
    }

  }

  isClosed() {
    if (!this._items) {
      return false;
    }
    return this._i === -1 || this._i >= this._items.length;
  }

  skip(v, cb) {
    if (!_.isFinite(v)) {
      this._err = new Error("skip requires an integer");
      if (!cb) {
        throw this._err;
      }
    }

    if (this._i != 0) {
      this._err = new Error('Cursor is closed');
      if (!cb) {
        throw this._err;
      }
    }

    if (!this._err) {
      this._skip = v;
    }

    if (cb) {
      safe.back(cb, this._err, this);
    }
    return this;
  }

  sort(v, d, cb) {
    if (_.isFunction(d)) {
      cb = d;
      d = null;
    }

    if (this._i != 0) {
      this._err = new Error('Cursor is closed');
    }

    if (!this._err) {
      this._err = _.attempt(() => {
        this.sortValue = v; // just to pass contrib test
        this._sort = parseSortList(v, d);
      });
    }

    if (cb) {
      safe.back(cb, this._err, this);
    }
    return this;
  }

  limit(v, cb) {
    if (!_.isFinite(v)) {
      this._err = new Error("limit requires an integer");
      if (!cb) {
        throw this._err;
      }
    }

    if (this._i != 0) {
      this._err = new Error('Cursor is closed');
      if (!cb) {
        throw this._err;
      }
    }
    if (!this._err) {
      this._limit = v === 0 ? null : Math.abs(v);
    }

    if (cb) {
      safe.back(cb, this._err, this);
    }
    return this;
  }

  nextObject(cb) {
    if (this._err) {
      if (cb) {
        safe.back(cb, this._err);
      }
      return;
    }
    this._ensure(safe.sure(cb, () => {
      if (this._i >= this._items.length) {
        return cb(null, null);
      }
      this._get(this._items[this._i], cb);
      this._i++;
    }));
  }

  count(applySkipLimit, cb) {
    if (!cb) {
      cb = applySkipLimit;
      applySkipLimit = false;
    }

    if (this._err) {
      if (cb) safe.back(cb, this._err);
      return;
    }

    if ((!this._skip && _.isNull(this._limit)) || applySkipLimit) {
      this._ensure(safe.sure(cb, () => {
        cb(null, this._items.length);
      }));
      return;
    }

    if (!_.isNull(this._count)) {
      safe.back(cb, null, this._count);
      return;
    }

    this._c._find(this._query, {}, 0, null, null, this._hint, this._arFields, safe.sure(cb, (data) => {
      this._count = data.length;
      cb(null, this._count);
    }));
  }

  setReadPreference(the, cb) {
    if (this._err) {
      if (cb) {
        safe.back(cb, this._err);
      }
      return;
    }
    return this;
  }

  batchSize(v, cb) {
    if (!_.isFinite(v)) {
      this._err = new Error("batchSize requires an integer");
      if (!cb) {
        throw this._err;
      }
    }

    if (this._i != 0) {
      this._err = new Error('Cursor is closed');
      if (!cb) {
        throw this._err;
      }
    }
    if (cb) {
      safe.back(cb, this._err, this);
    }
    return this;
  }

  close(cb) {
    this._items = [];
    this._i = -1;
    this._err = null;
    if (cb) {
      safe.back(cb, this._err, this);
    }
    return this;
  }

  rewind() {
    this._i = 0;
    return this;
  }

  toArray(cb) {
    if (!_.isFunction(cb)) {
      throw new Error('Callback is required');
    }

    var self = this;

    if (this.isClosed()) {
      this._err = new Error("Cursor is closed");
    }

    if (this._err) {
      if (cb) {
        safe.back(cb, this._err);
      }
      return;
    }

    this._ensure(safe.sure(cb, () => {
      safe.mapSeries(this._i != 0 ? this._items.slice(this._i, this._items.length) : this._items, (pos, cb) => {
        this._get(pos, safe.sure(cb, (obj) => {
          cb(null, obj);
        }));
      }, safe.sure(cb, (res) => {
        this._i = this._items.length;
        cb(null, res);
      }));
    }));
  }

  each(cb) {
    if (!_.isFunction(cb)) {
      throw new Error('Callback is required');
    }

    var self = this;

    if (this.isClosed()) {
      this._err = new Error("Cursor is closed");
    }

    if (this._err) {
      if (cb) {
        safe.back(cb, this._err);
      }
      return;
    }

    this._ensure(safe.sure(cb, () => {
      safe.eachOfSeries(this._i != 0 ? this._items.slice(this._i, this._items.length) : this._items, (pos, k, cb1) => {
        this._get(pos, safe.sure(cb, (obj) => {
          cb(null, obj);
          cb1();
        }));
      }, safe.sure(cb, () => {
        this._i = this._items.length;
        cb(null, null);
      }));
    }));
  }

  stream(options) {
    return new CursorStream(this, options);
  }

  _ensure(cb) {
    if (this._items != null) {
      return safe.back(cb);
    }
    this._c._find(this._query, {}, this._skip, this._limit, this._sort, this._hint, this._arFields, safe.sure_result(cb, (data) => {
      this._items = data;
      this._i = 0;
    }));
  }

  _projectFields(obj) {
    if (!_.isNull(this._fieldsType)) {
      if (this._fieldsType === 0) {
        applyProjectionDel(obj, this._fields);
      } else {
        obj = applyProjectionGet(obj, this._fields, this._fieldsExcludeId ? {} : {_id: obj._id});
      }
    }
    return obj;
  }

  _get(pos, cb) {
    this._c._get(pos, false, safe.sure(cb, (obj) => {
      cb(null, this._projectFields(obj));
    }));
  }
}

// todo переписать
function applyProjectionDel(obj, $set) {
  _.each($set, function (v, k) {
    var path = k.split(".");
    var t = null;
    if (path.length == 1){
      t = obj;
    } else {
      var l = obj;
      for (var i = 0; i < path.length - 1; i++) {
        var p = path[i];
        if (l[p] == null)
          break;
        l = l[p];
      }
      t = i == path.length - 1 ? l : null;
      k = path[i];
    }
    if (t)
      delete t[k];
  });
}

// todo переписать
function applyProjectionGet(obj, $set, nobj) {
  _.each($set, function (v, k) {
    var path = k.split(".");
    var t = null, n = null;
    if (path.length == 1) {
      t = obj;
      n = nobj;
    } else {
      var l = obj, nl = nobj;
      for (var i = 0; i < path.length - 1; i++) {
        var p = path[i];
        if (l[p] == null) break;
        l = l[p];
        if (nl[p] == null) nl[p] = {};
        nl = nl[p];
      }

      if (i == path.length - 1) {
        t = l;
        n = nl;
      }
      k = path[i];
    }

    if (!_.isUndefined(t[k])) {
      n[k] = t[k];
    }
  });
  return nobj;
}

function parseSortList(l, d) {
  const message = `Illegal sort clause, 
  must be of the form [['field1', '(ascending|descending)'], 
  ['field2', '(ascending|descending)']]`;

  // null or empty string
  if (!l) {
    return null;
  }

  // sanity check
  if (!_.isObject(l) && !_.isString(l)) {
    throw new Error(message);
  }

  // 'a' => [ [ 'a', 1 ] ]
  if (!d) {
    d = 1;
  }

  // 'a', 1 => [ [ 'a', 1 ] ]
  if (_.isString(l)) {
    l = [[l, d]];
  }

  // { a: 1, b: -1 } => [ [ 'a', 1 ], [ 'b', -1 ] ]
  else if (!_.isArray(l)) {
    l = _.map(l, function (v, k) {
      return [k, v];
    });
  }

  // [ 'a', 1 ], [ 'a', 'asc' ] => [ [ 'a', 1 ] ]
  else if (_.isString(l[0]) && (l[1] === 1 || l[1] === -1 ||
      l[1] === 'asc' || l[1] === 'ascending' ||
      l[1] === 'desc' || l[1] === 'descending')) {
    l = [l];
  }

  // [ 'a', 'b' ] => [ [ 'a', 1 ], [ 'b', 1 ] ]
  else if (_.every(l, _.isString)) {
    l = _.map(l, function (v) {
      return [v, d];
    });
  }

  // empty array or object
  if (_.isEmpty(l)) {
    return null;
  }

  // 'asc', 'ascending' => 1; 'desc', 'descending' => -1
  return _.map(l, function (v) {
    let d = v[1];
    if (d === 'asc' || d === 'ascending') {
      d = 1;
    } else if (d === 'desc' || d === 'descending') {
      d = -1;
    }
    if (d != 1 && d != -1) {
      throw new Error(message);
    }
    return [v[0], d];
  });
}
