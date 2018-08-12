import safe from 'safe';

const noop = () => {
};

export default class WQueue {
  constructor(limit, first) {
    this.limit = limit || 100;
    this._rc = 0;
    this._q = [];
    this._blocked = false;
    this._stoped = false;
    this._tc = -1;
    this.first = first || function (cb = noop) {
      cb();
    };
  }

  add(task, block, cb = noop) {
    this._q.push({task, block, cb});
    this._ping();
  }

  _exec(task, block, cb) {
    this._blocked = block;
    this._tc++;

    if (this._tc === 0) {
      this._blocked = true;
      this.first((err) => {
        if (err) {
          // restore to initial state on error
          this._blocked = false;
          this._tc--;
          return cb(err);
        }
        this._exec(task, block, cb);
      });
    } else {
      this._rc++;
      task(function () {
        cb.apply(this, arguments);
        this._rc--;
        if (this._rc === 0) {
          this._blocked = false;
        }
        this._ping();
      });
    }
  }

  _ping() {
    safe.back(() => {
      while (this._q.length > 0 && this._rc < this.limit && !this._blocked && (!this._q[0].block || this._rc === 0)) {
        let t = this._q.splice(0, 1)[0];
        if (this._stoped) {
          t.cb(new Error("Database is closed"));
        } else {
          this._exec(t.task, t.block, t.cb);
        }
      }
    });
  }
}
