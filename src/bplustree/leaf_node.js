import InternalNode from './internal_node';

export default class LeafNode {
  constructor(order, compare) {
    this.order = order;
    this.compare = compare;
    this.isLeafNode = true;
    this.isInternalNode = false;

    this.parentNode = null;
    this.nextNode = null;
    this.prevNode = null;

    this.data = [];
  }

  split() {
    let tmp = new LeafNode(this.order, this.compare);
    let m = Math.ceil(this.data.length / 2);
    let k = this.data[m - 1].key;

    // Copy & shift data
    for (let i = 0; i < m; i++) {
      tmp.data[i] = this.data.shift();
    }
    tmp.parentNode = this.parentNode;
    tmp.nextNode = this;
    tmp.prevNode = this.prevNode;
    if (tmp.prevNode) {
      tmp.prevNode.nextNode = tmp;
    }
    this.prevNode = tmp;

    if (!this.parentNode) {
      let p = new InternalNode(this.order, this.compare);
      this.parentNode = tmp.parentNode = p;
    }

    return this.parentNode.insert(k, tmp, this);
  }

  insert(key, value) {
    let pos = 0;
    for (; pos < this.data.length; pos++) {
      if (this.compare(this.data[pos].key, key) === 0) {
        this.data[pos].value = value;
        return null;
      }

      if (this.compare(this.data[pos].key, key) > 0) {
        break;
      }
    }

    if (this.data[pos]) {
      this.data.splice(pos, 0, {"key": key, "value": value});
    } else {
      this.data.push({"key": key, "value": value});
    }

    // Split
    if (this.data.length > this.order) {
      return this.split();
    }

    return null;
  }
}
