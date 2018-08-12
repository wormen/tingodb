export default class InternalNode {
  constructor(order, compare) {
    this.order = order;
    this.compare = compare;
    this.isLeafNode = false;
    this.isInternalNode = true;

    this.parentNode = null;

    this.data = [];
  }

  split() {
    let m = null;
    if (this.order % 2) {
      m = (this.data.length - 1) / 2 - 1;
    } else {
      m = (this.data.length - 1) / 2;
    }

    let tmp = new InternalNode(this.order, this.compare);
    tmp.parentNode = this.parentNode;
    for (let i = 0; i < m; i++) {
      tmp.data[i] = this.data.shift();
    }
    for (let i = 0; i < tmp.data.length; i += 2) {
      tmp.data[i].parentNode = tmp;
    }
    let key = this.data.shift();

    if (!this.parentNode) {
      this.parentNode = tmp.parentNode = new InternalNode(this.order, this.compare);
    }

    return this.parentNode.insert(key, tmp, this);
  }

  insert(key, node1, node2) {
    if (this.data.length) {
      let pos = 1;
      for (; pos < this.data.length; pos += 2) {
        if (this.compare(this.data[pos], key) > 0) {
          break;
        }
      }

      if (pos < this.data.length) {
        pos--;
        this.data.splice(pos, 0, key);
        this.data.splice(pos, 0, node1);
      } else {
        this.data[pos - 1] = node1;
        this.data.push(key);
        this.data.push(node2);
      }

      if (this.data.length > (this.order * 2 + 1)) {
        return this.split();
      }
      return null;
    }

    this.data[0] = node1;
    this.data[1] = key;
    this.data[2] = node2;
    return this;
  }
}
