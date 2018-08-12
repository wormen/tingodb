export default class TCache {
  constructor(tdb, size = 1000) {
    this._tdb = tdb;
    this.size = size;
    this._cache = [];
    this._cache.length = this.size;
    this.clear();
  }

  clear() {
    for (let i = 0; i < this._cache.length; i++) {
      this._cache[i] = {k: null};
    }
  }

  set(k, v) {
    this._cache[k % this.size] = {k, v: this._tdb._cloneDeep(v)};
  }

  unset(k) {
    let c = this._cache[k % this.size];
    if (c.k === k) {
      this._cache[k % this.size] = {k: null};
    }
  }

  get(k, unsafe){
    let c = this._cache[k % this.size];
    return c.k === k ? (unsafe ? c.v : this._tdb._cloneDeep(c.v)) : null;
  }
}
