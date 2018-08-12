import _ from 'lodash';
import BPlusTree from './bplustree';

export default class TIndex {
  constructor(key, tcoll, options = {}, name) {
    this.options = options;
    this.name = name || key + '_';
    this._unique = options.unique || false;
    this._c = tcoll;
    this._nuls = Object.create(null);
    this._array = this.options._tiarr || false;
    this.key = key[0][0];
    this.order = key[0][1];

    if (key.length > 1) {
      this._sub = key.slice(1);
    }

    this._bp = BPlusTree.create({sort: this.order, order: 100});

    let getter = new tcoll._tdb.Finder.field(this.key);
    this._get = new Function("obj", "return " + (this._array ? getter.native3() : getter.native()));
  }

  clear() {
    if (this.count()) {
      this._bp = BPlusTree.create({sort: this.order, order: 100});
    }
  }

  set(k_, v, check) {
    let k = this._get(k_);

    if (check) {
      if (!this._sub && this._unique && this._bp.get(k) !== null) {
        throw new Error("duplicate key error index");
      }
    } else {
      if (Array.isArray(k)) {
        _.each(k, (k1) => {
          this._set(k1, v, k_);
        });
      } else {
        return this._set(k, v, k_);
      }
    }
  }

  _set(k, v, o) {
    if (this._sub) {
      let s = (_.isNull(k) || _.isUndefined(k)) ? this._nuls[v] : this._bp.get(k);
      if (!s) {
        s = new TIndex(this._sub, this._c, this.options, this.name + '_' + k);
        if (_.isNull(k) || _.isUndefined(k)) {
          this._nuls[v] = s;
        } else {
          this._bp.set(k, s);
        }
      }
      s.set(o, v);
      return;
    }

    if (_.isNull(k) || _.isUndefined(k)) {
      this._nuls[v] = v;
      return;
    }

    if (this._unique) {
      return this._bp.set(k, v);
    }

    let l = this._bp.get(k);
    let n = l || [];
    n.push(v);
    if (!l) {
      this._bp.set(k, n);
    }
  }

  del(k_, v) {
    let k = this._get(k_);
    if (Array.isArray(k)) {
      _.each(k, (k1) => {
        this._del(k1, v, k_);
      });
    } else {
      return this._del(k, v, k_);
    }
  }

  _del(k, v, o) {
    if (this._sub) {
      let s = (_.isNull(k) || _.isUndefined(k)) ? this._nuls[v] : this._bp.get(k);
      if (s) {
        s.del(o, v);
      }
      return;
    }

    delete this._nuls[v];

    if (this._unique) {
      this._bp.del(k);
    } else {
      let l = this._bp.get(k);
      if (l) {
        let i = l.indexOf(v);
        if (i != -1) {
          l.splice(i, 1);
        }
        if (l.length === 0) {
          this._bp.del(k);
        }
      }
    }
  }

  match(k) {
    let m = this._bp.get(k);
    if (!m) {
      return [];
    }
    return this._unique || this._sub ? [m] : m;
  }

  range(s, e, si, ei) {
    let r = this._bp.rangeSync(s, e, si, ei);
    return this._unique || this._sub ? r : _.flatten(r);
  }

  all(order, shallow) {
    let a = this._bp.all();
    let n = _.values(this._nuls);
    let r = this.order > 0 ? _.union(n, a) : _.union(a, n);
    if (order && order.length > 0) {
      if (order[0] != this.order) {
        r = r.reverse();
      }
      order = order.slice(1);
    }
    if (this._sub) {
      return shallow ? r : _(r).map(function (i) {
        return i.all(order);
      }).flattenDeep().value();
    }
    return this._unique ? r : _.flatten(r);
  }

  nuls() {
    return _.values(this._nuls);
  }

  values() {
    let r = this._bp.all();
    return this._unique || this._sub ? r : _.flatten(r);
  }

  count() {
    let c = 0;
    this._bp.each((k, v) => {
      c += this._sub ? v.count() : v.length;
    });
    return c;
  }

  fields() {
    let result = [[this.key, this.order]];
    if (this._sub) {
      result = result.concat(this._sub);
    }
    return result;
  }

  depth() {
    return this._sub ? this._sub.length + 1 : 1;
  }

  inspect(depth) {
    return `[Index ${this.name}]`;
  }
}

/* IDEAS
 *
 * - Keep some stats about index to allow of making decisions about which index to use in query
 *
 */
