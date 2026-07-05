class ProductProvider {
  async search(_query, _options = {}) {
    throw new Error('search() not implemented');
  }
}

module.exports = {ProductProvider};
