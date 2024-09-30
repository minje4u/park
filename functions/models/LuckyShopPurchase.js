const mongoose = require('mongoose');

const luckyShopPurchaseSchema = new mongoose.Schema({
  groupNumber: { type: String, required: true },
  itemName: { type: String, required: true },
  purchaseDate: { type: Date, default: Date.now },
  isDelivered: { type: Boolean, default: false },
  deliveryDate: { type: Date }
});

module.exports = mongoose.model('LuckyShopPurchase', luckyShopPurchaseSchema);
