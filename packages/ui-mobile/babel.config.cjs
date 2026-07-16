// .cjs (nao .js): o pacote e "type": "module" — o Jest/Babel precisam de um
// arquivo de config interpretado como CommonJS independente disso.
module.exports = {
  presets: ['module:@react-native/babel-preset'],
};
