const mongoose = require('mongoose');

const luckyShopItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  points: { type: Number, required: true },
});

module.exports = mongoose.model('LuckyShopItem', luckyShopItemSchema);